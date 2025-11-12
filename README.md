# Finance Management Docker Deployment

## Overview
This repository packages the Finance Management Next.js front end and Express API into a Docker Compose stack that keeps internal dependencies isolated on the private `finance-management_net` while exposing only the `finance-management-web` container to the shared `edge_net`. A centrally managed Nginx reverse proxy (deployed elsewhere on the VPS) owns `edge_net`, publishes ports 80/443, and forwards hostname-based traffic to this application without any host ports opened by the app stack itself. The API, MongoDB, and Redis stay on the private network; the web tier proxies API traffic internally so nothing except the browser-facing Next.js server needs to be reachable from the edge.

## Prerequisites
- A VPS (or bare-metal host) already running the shared edge Nginx deployment that creates and manages the external `edge_net` network and publishes TCP ports 80 and 443.
- DNS for `finance.example.com` (`${APP_SUBDOMAIN}.${BASE_DOMAIN}`) points at the VPS.
- Docker Engine and Docker Compose Plugin installed on the VPS.

## Environment Setup
1. Copy the bundled templates and adjust them for your environment:
   ```bash
   cp env/prod.env.example env/prod.env
   cp server/.env.compose.example server/.env.compose
   cp client/.env.compose.example client/.env.compose
   ```
2. Fill in runtime secrets (MongoDB credentials, JWT secrets, NextAuth secret, SMTP credentials, etc.) and adjust domains and URLs for your environment. Keep the resulting files private—never commit them to source control.

## Networks
- `edge_net` is an external bridge network managed by the centralized Nginx deployment. Confirm it exists with `docker network ls` on the VPS before starting this stack.
- `finance-management_net` is defined by `compose.yml` and marked `internal: true`, preventing direct inbound connections from the host or other containers outside this network. Docker Compose creates it automatically on the first `up`.

## Running
1. Ensure the shared `edge_net` already exists (`docker network create edge_net` should **not** be run here; the edge stack owns it).
2. Start the application in detached mode using the production settings:
   ```bash
   docker compose --env-file env/prod.env -f compose.yml up -d
   ```
   The central Nginx instance will proxy inbound requests on `finance.example.com` to the `finance-management-web` container on port 3000 via `edge_net`. All `/api/*` calls are handled by the Next.js server, which forwards them to the internal API container over the private network.
   For local development, switch to `env/dev.env` and include `compose.dev.yml --profile local-db` to spin up the optional MongoDB container alongside the stack.
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
  docker compose logs -f finance-management-redis
  # Only when the optional local MongoDB profile is active
  docker compose logs -f finance-management-db
  ```
- Manually verify service health from inside the containers:
  ```bash
  docker compose exec finance-management-web curl -fsS http://127.0.0.1:3000/
  docker compose exec finance-management-api curl -fsS http://127.0.0.1:5000/healthz
  docker compose exec finance-management-redis redis-cli ping
  # Only when the optional local MongoDB profile is active
  docker compose exec finance-management-db mongosh --quiet --eval 'db.adminCommand({ ping: 1 })'
  ```

## Persistence
- MongoDB data persists inside the named volume `finance-management-mongo-data` when the `local-db` profile is enabled. Back it up regularly, for example:
  ```bash
  docker run --rm -v finance-management-mongo-data:/data busybox tar czf - /data > mongo-backup.tgz
  ```
- Redis stores session locks and tokens in `finance-management-redis-data`. Back up this volume if retaining session continuity across restarts is important; otherwise it can be treated as disposable cache data.

## Security
- No service in this stack publishes host ports; only the shared edge Nginx service faces the public internet.
- Secrets remain in the copied environment files (`env/*.env`, `server/.env.compose`, `client/.env.compose`) and are injected at runtime via Compose.
- API, MongoDB, and Redis run exclusively on the internal `finance-management_net` and are unreachable from other applications or the host.

## Central Nginx (shared across apps)
The edge proxy runs separately from this repository. It should be deployed once on the VPS, own the `edge_net` network, manage TLS certificates, and publish `:80`/`:443`. Each application stack (including this one) connects its public `*-web` service to `edge_net` so the proxy can route traffic by hostname.

Example edge deployment (maintained outside this repo):

`compose.nginx.yml`
```yaml
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
  server_name finance.example.com;

  # ACME HTTP-01 challenge (adjust path if using certbot)
  location /.well-known/acme-challenge/ { root /var/www/html; }

  location / {
    proxy_pass http://finance-management_web;
    include /etc/nginx/proxy_params;
  }
}
```

> **Why no direct `/api` upstream?** The Next.js application exposes an `/api/proxy/*` route that forwards authenticated API requests to the Express backend over the private `finance-management_net`. External traffic therefore only hits the web tier, keeping the API fully isolated from the edge network.

`nginx/proxy_params`
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 60s;
proxy_send_timeout 60s;
```

### TLS Guidance
- Issue certificates for `finance.example.com` using Certbot or an ACME client integrated with the edge stack.
- Redirect HTTP to HTTPS using an additional `server` block or `return 301 https://$host$request_uri;` inside the port 80 block once certificates are issued.
- Ensure the edge Nginx container is the only service joined to `edge_net` aside from application `*-web` containers.

With this layout, the Next.js front end is the only component exposed to the shared edge network, while the API, MongoDB, and Redis remain protected on the private network.
