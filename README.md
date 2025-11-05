# Finance Management Docker Deployment

## Overview
This repository packages the Finance Management API into a self-contained Docker Compose stack that isolates all internal services on a private `finance-management_net` while exposing the public web container to the shared `edge_net`. A centrally managed Nginx reverse proxy (deployed elsewhere on the VPS) owns `edge_net`, publishes ports 80/443, and forwards hostname-based traffic to this application with no direct host port exposure from the app stack.

## Prerequisites
- A VPS (or bare-metal host) already running the shared edge Nginx deployment that creates and manages the external `edge_net` network and publishes TCP ports 80 and 443.
- DNS for `finance.example.com` (`${APP_SUBDOMAIN}.${BASE_DOMAIN}`) points at the VPS.
- Docker Engine and Docker Compose Plugin installed on the VPS.

## Environment Setup
1. Copy `.env.example` to `.env` in the repository root.
2. Fill in secrets (JWT, email, MongoDB credentials, etc.) and adjust domains, ports, and SMTP settings for your environment.
3. Keep `.env` private—never commit it to source control.

## Networks
- `edge_net` is an external bridge network managed by the centralized Nginx deployment. Confirm it exists with `docker network ls` on the VPS before starting this stack.
- `finance-management_net` is defined by `docker-compose.yml` and marked `internal: true`, preventing direct inbound connections from the host or other containers outside this network. Docker Compose will create it automatically on the first `up`.

## Running
1. Ensure the shared `edge_net` already exists (`docker network create edge_net` should **not** be run here; the edge stack owns it).
2. Start the application in detached mode:
   ```bash
   docker compose up -d
   ```
   The central Nginx instance will proxy inbound requests on `finance.example.com` to `finance-management-web` via `edge_net`.
3. To execute one-off tasks (tests, migrations, scripts), run:
   ```bash
   docker compose run --rm finance-management-web npm run test
   ```
   Replace `npm run test` with any other Node.js command required for maintenance tasks.

## Health & Logs
- Check container status and healthchecks:
  ```bash
  docker compose ps
  ```
- View logs for the web API:
  ```bash
  docker compose logs -f finance-management-web
  ```
- Inspect MongoDB logs:
  ```bash
  docker compose logs -f finance-management-db
  ```
- Manually verify the application health endpoint from another container on `edge_net`:
  ```bash
  docker compose exec finance-management-web curl -fsS http://127.0.0.1:5000/healthz
  ```

## Persistence
- MongoDB data is stored in the named volume `finance-management-mongo-data`. Back up this volume regularly (e.g., `docker run --rm -v finance-management-mongo-data:/data busybox tar czf - /data > mongo-backup.tgz`).

## Security
- The application stack never publishes host ports; only the shared edge Nginx service faces the public internet.
- Secrets remain in `.env` and are injected at runtime.
- MongoDB is confined to the internal network and is not reachable from other apps or the host.

## Central Nginx (shared across apps)
The edge proxy runs separately from this repository. It should be deployed once on the VPS, own the `edge_net` network, manage TLS certificates, and publish `:80`/`:443`. Each application stack (including this one) connects its `*-web` service to `edge_net` so the proxy can route traffic by hostname.

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
upstream finance-management_upstream {
  server finance-management-web:5000;
}
server {
  listen 80;
  server_name finance.example.com;
  # ACME HTTP-01 challenge (adjust path if using certbot)
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / {
    proxy_pass http://finance-management_upstream;
    include /etc/nginx/proxy_params;
  }
}
```

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

With this layout, each application remains isolated on its private network, while the central proxy provides unified TLS termination, routing, and logging across the VPS.
