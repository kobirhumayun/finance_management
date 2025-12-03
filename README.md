# Finance Management Docker Deployment

## Overview
## Overview
This repository packages the Finance Management Next.js front end and Express API into a Docker Compose stack that keeps internal dependencies isolated on the private `finance-management_net` while exposing only the `finance-management-web` container to the shared `edge_net`. A centrally managed Nginx reverse proxy (deployed elsewhere on the VPS) owns `edge_net`, publishes ports 80/443, and forwards hostname-based traffic to this application without any host ports opened by the app stack itself. The API shares the private network with MongoDB and Redis but now also joins a second outbound-only bridge that it can use to reach remote MongoDB clusters when `MONGO_URI` points off-box; the web tier proxies API traffic internally so nothing except the browser-facing Next.js server needs to be reachable from the edge.

The stack also includes a dedicated **PDF Generation Service** (`finance-management-pdf`) that runs a headless Chromium browser (Playwright) to generate transaction summary reports. This service is isolated in its own container to manage resource usage (CPU/RAM) independently from the main API.

## Prerequisites
- A VPS (or bare-metal host) already running the shared edge Nginx deployment that creates and manages the external `edge_net` network and publishes TCP ports 80 and 443.
- DNS for `finance.example.com` (`${APP_SUBDOMAIN}.${BASE_DOMAIN}`) points at the VPS.
- Docker Engine and Docker Compose Plugin installed on the VPS.

## Environment Setup
1. Pick the template that matches your workflow and copy it to `.env` in the repository root:
   - `.env.local.template` &rarr; `.env` for local development or hot reload workflows (e.g., `docker compose --profile localdb up`).
   - `.env.production.template` &rarr; `.env` for staging/production deployments.
   - `.env.example` is the canonical checklist of every supported variable; consult it when you need knobs that are not pre-filled in the templates above.
2. Each template includes two `MONGO_URI` examples under the “Backend configuration” section. `MONGO_URI` now stops at the host/credentials while `MONGO_DB` declares the database name:
   - The first URI targets the bundled MongoDB container (`finance-management-db`) and should stay uncommented when you want Compose to spin up the local database.
   - The second URI shows an external MongoDB Atlas (or any other cluster) host. Uncomment that line and comment/remove the local URI when you need to target an outside database; update the hostname, username, and password to match your cluster and leave `MONGO_DB` set to the desired database name.
3. Fill in the remaining runtime secrets (MongoDB credentials, JWT secrets, NextAuth secret, SMTP credentials, etc.) and adjust domains and URLs for your environment.
4. Keep `.env` private—never commit it to source control.

## Usage Matrix
Use the combinations below to quickly start the stack in each environment. Every command assumes you are running it from the repo root and have already created the `.env` file described above. Before launching, double-check that the `MONGO_URI` line in `.env` targets the database (local container or external cluster) you expect for that row.

| Scenario | Compose command |
| --- | --- |
| **Dev + LocalDB** | `docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile localdb up --build` |
| **Dev + ExternalDB** | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` |
| **Prod + LocalDB** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile localdb up --build -d` |
| **Prod + ExternalDB** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` |

> ℹ️ Use `--profile localdb` only when you want Docker Compose to launch the bundled MongoDB service. When pointing at an external database (Atlas, self-hosted cluster, etc.), omit the profile flag and ensure the local database service remains stopped.

> ℹ️ Append `--build` when starting the stack to force Docker to rebuild the images and pick up the latest source or dependency changes before containers boot.

## Networks
- `edge_net` is an external bridge network managed by the centralized Nginx deployment. Confirm it exists with `docker network ls` on the VPS before starting this stack.
- `finance-management_net` is defined by `docker-compose.yml`, marked `internal: true`, and hosts the API, MongoDB, Redis, and web containers so data never crosses the Docker host boundary.
- `finance-management_outbound` is an internal-to-this-stack bridge network that only the API (and optionally the web tier, if ever needed) should use for egress. The API attaches to both networks simultaneously, keeping MongoDB/Redis isolated on the internal network while giving the API a dedicated outbound path to contact managed services such as MongoDB Atlas when `MONGO_URI` references an external host.

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
- Uploaded transaction attachments and profile photos live under the path defined by `UPLOADS_ROOT` (defaults to `/app/uploads` inside the API container). The Compose stack automatically mounts the `finance-management-uploads` named volume at that path so user-provided files survive container restarts and deployments. If you override `UPLOADS_ROOT`, update the Compose volume target to match the new in-container path.

## Security
- No service in this stack publishes host ports; only the shared edge Nginx service faces the public internet.
- Secrets remain in `.env` and are injected at runtime via Compose.
- MongoDB and Redis remain isolated on the internal `finance-management_net`, while the API bridges that network with the outbound-only `finance-management_outbound` so it can reach remote dependencies without exposing the databases themselves.

## Central Nginx (shared across apps)
The edge proxy runs separately from this repository. It should be deployed once on the VPS, own the `edge_net` network, manage TLS certificates, and publish `:80`/`:443`. Each application stack (including this one) connects its public `*-web` service to `edge_net` so the proxy can route traffic by hostname.

### Step-by-step setup
1. **Bootstrap the proxy container**
   ```bash
   docker compose -f compose.nginx.yml up -d
   ```
   This starts the `edge-nginx` service, publishes ports 80/443, mounts the configuration directories, and creates (or joins) the shared `edge_net` bridge network. Every application stack that needs public ingress must attach its web-facing container to `edge_net`.
2. **Create a server block per application**
   Copy `nginx/conf.d/finance.conf` and adjust the `upstream` and `server_name` directives for each hostname you plan to proxy. For additional apps, create `nginx/conf.d/<app>.conf` files that mirror this template.
3. **Issue TLS certificates**
   Use Certbot or another ACME client that writes certificates under `./letsencrypt`. Uncomment the HTTPS server block in `nginx/conf.d/finance.conf` once the certificate paths exist (see inline comments in that file for exact directives).
4. **Reload Nginx after any config change**
   ```bash
   docker compose -f compose.nginx.yml exec nginx nginx -s reload
   ```

### Reference files included in this repo

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
    name: edge_net
    driver: bridge
    attachable: true
```

`nginx/conf.d/finance.conf`
```nginx
upstream finance_management_web {
  # The Docker Compose service name and internal port for the Next.js frontend.
  server finance-management-web:3000;
}

server {
  listen 80;
  listen [::]:80;
  server_name finance.localhost finance.example.com; # Replace with your subdomains.

  # Allow ACME HTTP-01 challenges for certificate issuance (Certbot mounts ./www).
  location /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  location / {
    proxy_pass http://finance_management_web;
    include /etc/nginx/proxy_params;
  }

  # Uncomment after TLS certificates exist in ./letsencrypt/live/<domain>/
  # return 301 https://$host$request_uri;
}

# Example HTTPS block (commented to serve as a template)
# server {
#   listen 443 ssl http2;
#   listen [::]:443 ssl http2;
#   server_name finance.example.com; # Match the hostnames from the HTTP block
#
#   ssl_certificate     /etc/letsencrypt/live/finance.example.com/fullchain.pem;
#   ssl_certificate_key /etc/letsencrypt/live/finance.example.com/privkey.pem;
#   include /etc/letsencrypt/options-ssl-nginx.conf; # Provided by Certbot
#   ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
#
#   location / {
#     proxy_pass http://finance_management_web;
#     include /etc/nginx/proxy_params;
#   }
# }
```

> **Why no direct `/api` upstream?** The Next.js application exposes an `/api/proxy/*` route that forwards authenticated API requests to the Express backend over the private `finance-management_net`. External traffic therefore only hits the web tier, keeping the API fully isolated from the edge network.

`nginx/proxy_params`
```nginx
# Shared headers for every proxied request. Extend as needed for WebSocket-heavy apps.
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

### TLS & subdomain checklist
- Issue certificates for every subdomain handled by the edge proxy (e.g., `finance.example.com`).
- Uncomment and customize the HTTPS block in `nginx/conf.d/finance.conf` once certificates exist.
- Add additional `server` blocks per subdomain/application and reload Nginx after editing.
- Ensure the edge Nginx container is the only service joined to `edge_net` aside from application `*-web` containers.

With this layout, the Next.js front end is the only component exposed to the shared edge network, while the API, MongoDB, and Redis remain protected on the private network. Nginx terminates TLS, routes requests by hostname, and forwards traffic to the appropriate internal service without opening host ports on the app stack.

# BACKUP & DISASTER RECOVERY GUIDE

## 1. Overview
This project uses a containerized **Restic** solution for efficient, chunk-based deduplicated backups. The system automatically dumps the MongoDB database and syncs both the dump and the `uploads/` volume to a secure repository.

---

## 2. Setup & Configuration

### Environment Variables (.env)
Add these variables to your `.env` file on both your local machine and VPS:

# --- BACKUP CONFIGURATION ---
# Secure password to encrypt the backup repository (Keep this safe!)
RESTIC_PASSWORD="change_this_to_a_very_secure_password"

# Internal container path for the repository.
# Maps to './backups' on the host via docker-compose.yml
RESTIC_REPOSITORY="/repo"

# Database connection (host/credentials only) and name
MONGO_URI=mongodb://root:example@finance-management-db:27017?authSource=admin
MONGO_DB=finance_db


---

## 3. How to Backup

The backup container is a "one-off" task. It dumps the DB, pushes changes to Restic, and prunes old snapshots. The dump uses `--nsInclude=${MONGO_DB}.*` (avoiding deprecated `--db/--collection` flags); pass additional `mongodump` options—like extra `--nsInclude` filters to scope specific collections—via `MONGODUMP_EXTRA_ARGS` when invoking the container.

### Manual Backup (Windows & Linux)
Run this command anytime to trigger an immediate backup:

docker compose run --rm finance-management-backup


### Automated Backup (Ubuntu VPS)
Set up a cron job to run nightly (e.g., at 3 AM).
1. Run `crontab -e`
2. Add the following line:

0 3 * * * cd /path/to/finance_management && docker compose run --rm finance-management-backup >> /var/log/backup.log 2>&1


---

## 4. How to Restore (Disaster Recovery)

⚠️ **WARNING:** These commands will DELETE your current database and uploads, replacing them with the latest backup.

### Option A: Restore on Ubuntu VPS (Production)
Use the standard restoration command. The restore step also scopes to `--nsInclude=${MONGO_DB}.*` by default; set `MONGORESTORE_EXTRA_ARGS` to forward `--ns*` flags (for example, `--nsFrom/--nsTo` pairs) when you need to rewrite namespaces during a restore without touching credentials:

docker compose run --rm --entrypoint /restore.sh finance-management-backup

Example (restoring into a different database name without editing secrets):

MONGORESTORE_EXTRA_ARGS="--nsFrom=${MONGO_DB}.* --nsTo=finance_restore.*" \
docker compose run --rm --entrypoint /restore.sh finance-management-backup


### Option B: Restore on Windows (Git Bash)
You must use a double slash `//` for the script path to prevent Git Bash path conversion errors:

docker compose run --rm --entrypoint //restore.sh finance-management-backup


---

## 5. Syncing Backups (VPS <-> Local)

Use `rsync` to transfer the backup repository between your local machine and the VPS.

### Download Backups (VPS -> Local)
Run this in Git Bash on Windows to pull production backups to your machine:

mkdir -p backups
rsync -avz -e ssh user@your-vps-ip:/path/to/project/backups/ ./backups/


### Upload Backups (Local -> VPS)
Run this in Git Bash on Windows to push your local backups to the server (for restoration):

rsync -avz -e ssh ./backups/ user@your-vps-ip:/path/to/project/backups/