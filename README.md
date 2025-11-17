# Finance Management Docker Deployment

## Overview
This repository packages the Finance Management Next.js front end and Express API into a Docker Compose stack that keeps internal dependencies isolated on the private `finance-management_net` while exposing only the `finance-management-web` container to the shared `edge_net`. A centrally managed Nginx reverse proxy (deployed elsewhere on the VPS) owns `edge_net`, publishes ports 80/443, and forwards hostname-based traffic to this application without any host ports opened by the app stack itself. The API, MongoDB, and Redis stay on the private network; the web tier proxies API traffic internally so nothing except the browser-facing Next.js server needs to be reachable from the edge.

## Prerequisites
- A VPS (or bare-metal host) already running the shared edge Nginx deployment that creates and manages the external `edge_net` network and publishes TCP ports 80 and 443.
- DNS for `finance.example.com` (`${APP_SUBDOMAIN}.${BASE_DOMAIN}`) points at the VPS.
- Docker Engine and Docker Compose Plugin installed on the VPS.

## Environment Setup
1. Pick the template that matches your workflow and copy it to `.env` in the repository root:
   - `.env.local.template` &rarr; `.env` for local development or hot reload workflows (e.g., `docker compose --profile localdb up`).
   - `.env.production.template` &rarr; `.env` for staging/production deployments.
2. Each template includes two `MONGO_URI` examples under the “Backend configuration” section:
   - The first line points at the bundled MongoDB container (`finance-management-db`) and should stay uncommented when you want Compose to spin up the local database.
   - The second line shows an external MongoDB Atlas (or any other cluster) URI. Uncomment that line and comment/remove the local URI when you need to target an outside database; update the hostname, username, and password to match your cluster.
3. Fill in the remaining runtime secrets (MongoDB credentials, JWT secrets, NextAuth secret, SMTP credentials, etc.) and adjust domains and URLs for your environment.
4. Keep `.env` private—never commit it to source control.

## Usage Matrix
Use the combinations below to quickly start the stack in each environment. Every command assumes you are running it from the repo root and have already created the `.env` file described above. Before launching, double-check that the `MONGO_URI` line in `.env` targets the database (local container or external cluster) you expect for that row.

| Scenario | Compose command |
| --- | --- |
| **Dev + LocalDB** | `docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile localdb up` |
| **Dev + ExternalDB** | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` |
| **Prod + LocalDB** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile localdb up -d` |
| **Prod + ExternalDB** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |

> ℹ️ Use `--profile localdb` only when you want Docker Compose to launch the bundled MongoDB service. When pointing at an external database (Atlas, self-hosted cluster, etc.), omit the profile flag and ensure the local database service remains stopped.

## Networks
- `edge_net` is an external bridge network managed by the centralized Nginx deployment. Confirm it exists with `docker network ls` on the VPS before starting this stack.
- `finance-management_net` is defined by `docker-compose.yml` and marked `internal: true`, preventing direct inbound connections from the host or other containers outside this network. Docker Compose creates it automatically on the first `up`.

## Running
1. Ensure the shared `edge_net` already exists (`docker network create edge_net` should **not** be run here; the edge stack owns it).
2. Start the application in detached mode:
   ```bash
   docker compose up -d
   ```
   The central Nginx instance will proxy inbound requests on `finance.example.com` to the `finance-management-web` container on port 3000 via `edge_net`. All `/api/*` calls are handled by the Next.js server, which forwards them to the internal API container over the private network.
   > **Turbopack note:** The frontend build script disables the Turbopack worker process inside containers to avoid a known worker crash when building in Docker. If you explicitly need worker mode, set `NEXT_TURBOPACK_USE_WORKER=1` before running `npm run build`.
3. Run one-off tasks when required:
   ```bash
   docker compose run --rm finance-management-api npm run migrate
   docker compose run --rm finance-management-web npm run lint
   ```
   Replace the commands with any script you need (tests, database migrations, etc.).

## Health & Logs
- Check container status and healthchecks:
  ```bash
  docker compose ps
  ```
- View logs for each service:
  ```bash
  docker compose logs -f finance-management-web
  docker compose logs -f finance-management-api
  docker compose logs -f finance-management-db
  docker compose logs -f finance-management-redis
  ```
- Manually verify service health from inside the containers:
  ```bash
  docker compose exec finance-management-web curl -fsS http://127.0.0.1:3000/
  docker compose exec finance-management-api curl -fsS http://127.0.0.1:5000/healthz
  docker compose exec finance-management-redis redis-cli ping
  ```

## Persistence
- MongoDB data persists inside the named volume `finance-management-mongo-data`. Back it up regularly, for example:
  ```bash
  docker run --rm -v finance-management-mongo-data:/data busybox tar czf - /data > mongo-backup.tgz
  ```
- Redis stores session locks and tokens in `finance-management-redis-data`. Back up this volume if retaining session continuity across restarts is important; otherwise it can be treated as disposable cache data.

## Security
- No service in this stack publishes host ports; only the shared edge Nginx service faces the public internet.
- Secrets remain in `.env` and are injected at runtime via Compose.
- API, MongoDB, and Redis run exclusively on the internal `finance-management_net` and are unreachable from other applications or the host.

## Central Nginx (shared across apps)
The edge proxy runs separately from this repository. It should be deployed once on the VPS, own the `edge_net` network, manage TLS certificates, and publish `:80`/`:443`. Each application stack (including this one) connects its public `*-web` service to `edge_net` so the proxy can route traffic by hostname.

Example edge deployment (maintained outside this repo):

`compose.nginx.yml`
```yaml
version: "3.9"
services:
  nginx:
    image: nginx:stable
    container_name: edge-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/proxy_params:/etc/nginx/proxy_params:ro
      - ./letsencrypt:/etc/letsencrypt
      - ./www:/var/www/html
    restart: unless-stopped
    networks:
      - edge_net
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 5s
      retries: 3
networks:
  edge_net:
    driver: bridge
```

`nginx/conf.d/finance.conf`
```nginx
upstream finance-management_web {
  server finance-management-web:3000;
}

server {
  listen 80;
  listen [::]:80;
  server_name finance.localhost finance.example.com;

  # ACME HTTP-01 challenge (adjust path if using certbot)
  location /.well-known/acme-challenge/ { root /var/www/html; }

  location / {
    proxy_pass http://finance-management_web;
    include /etc/nginx/proxy_params;
  }
}
```

This repository now includes the referenced config (`nginx/conf.d/finance.conf`) and proxy parameter include (`nginx/proxy_params`) so the edge stack can start without additional scaffolding. Update the `server_name` directive and TLS configuration to match your deployment.

> **Why no direct `/api` upstream?** The Next.js application exposes an `/api/proxy/*` route that forwards authenticated API requests to the Express backend over the private `finance-management_net`. External traffic therefore only hits the web tier, keeping the API fully isolated from the edge network.

`nginx/proxy_params`
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_http_version 1.1;
proxy_redirect off;
proxy_cache_bypass $http_upgrade;
```

### TLS Guidance
- Issue certificates for `finance.example.com` using Certbot or an ACME client integrated with the edge stack.
- Redirect HTTP to HTTPS using an additional `server` block or `return 301 https://$host$request_uri;` inside the port 80 block once certificates are issued.
- Ensure the edge Nginx container is the only service joined to `edge_net` aside from application `*-web` containers.

With this layout, the Next.js front end is the only component exposed to the shared edge network, while the API, MongoDB, and Redis remain protected on the private network.
