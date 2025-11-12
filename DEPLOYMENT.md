# Deployment Guide

This project ships a Next.js frontend located in [`client/`](client) and an Express-based API server in [`server/`](server). Both services rely on environment variables that are documented in their respective `.env.example` files along with the shared presets under [`env/`](env). This guide walks through the configuration values that must be provided and outlines a repeatable process for promoting the stack to production.

## 1. Provision dependencies

Before you deploy, make sure the following shared services are available:

- **MongoDB** 5.x or newer.
- **Redis** 6.x or newer (used by the frontend for coordinating token refresh state).
- **Email provider** that supports either SMTP credentials or an API key compatible with Nodemailer.
- **Process manager** such as PM2, Docker, or a platform-as-a-service environment capable of running Node.js 18+.

## 2. Configure environment variables

Copy the sample files to the locations your deployment platform expects and fill in the secrets:

```bash
cp env/prod.env.example env/prod.env
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Populate the copies with the values that match your infrastructure. The tables below summarize the most important settings. Refer to the sample files for optional values.

- `env/prod.env` holds cross-service configuration such as ports, shared URLs, and authentication secrets.
- `server/.env` should contain API-specific overrides that you do not want to expose to other services.
- `client/.env` holds frontend-only values and should be mirrored to `.env.local` when running the Next.js server outside of Docker.

### Server settings

| Variable | Description |
| --- | --- |
| `PORT` | Port that the API server should listen on. |
| `MONGO_URI` | MongoDB connection string pointing at the production database. |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | Random, long secrets for signing JWTs. |
| `ACCESS_TOKEN_EXPIRY` / `REFRESH_TOKEN_EXPIRY` | Token lifetimes expressed in [zeit/ms](https://github.com/vercel/ms) notation (e.g. `15m`, `7d`). |
| `EMAIL_PROVIDER` | Choose `smtp` for username/password transports or the identifier of a Nodemailer transport (e.g. `sendgrid`). |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | SMTP fields that are required when `EMAIL_PROVIDER=smtp`. |
| `EMAIL_API_KEY`, `EMAIL_API_USER`, `EMAIL_SERVICE` | API-key credentials when `EMAIL_PROVIDER` is not SMTP. |
| `EMAIL_SECURE`, `EMAIL_REQUIRE_TLS`, `EMAIL_TLS_*` | Optional TLS tuning flags for hardened mail servers. |
| `DEFAULT_PASSWORD_RESET_REDIRECT` | HTTPS URL users should land on after resetting a password. |
| `SUBSCRIPTION_JOB_LOCK_TTL_MS` | Milliseconds the recurring subscription job should hold the MongoDB advisory lock. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins for browser requests. |

### Frontend settings

| Variable | Description |
| --- | --- |
| `AUTH_BACKEND_URL` | Base URL of the deployed backend API. |
| `AUTH_REFRESH_PATH` | Path on the backend that issues refreshed tokens. Usually `/api/users/refresh-token`. |
| `NEXTAUTH_SECRET` | Cryptographically strong secret used by NextAuth to sign cookies and tokens. |
| `AUTH_KEY_SALT` | Optional salt for extra hashing of identifiers. Defaults to `NEXTAUTH_SECRET` if omitted. |
| `REDIS_URL` | Connection string for the Redis instance coordinating token refreshes. |
| `AUTH_REDIS_PREFIX` | Prefix applied to keys written in Redis. Set a unique value per environment. |
| `REGISTER_TIMEOUT_MS`, `PROXY_TIMEOUT_MS`, `PASSWORD_RESET_TIMEOUT_MS` | Millisecond timeouts applied to the respective API routes. |
| `NEXT_PUBLIC_PASSWORD_RESET_REDIRECT_URL` | HTTPS URL exposed to the browser for password reset flows. Must include protocol. |

### Secret management tips

- Generate secrets using a password manager or a secure random generator (`openssl rand -hex 32`).
- Never commit `.env` files to source control.
- When deploying to cloud platforms, define the variables using the platform's secret management feature.

## 3. Build artifacts

Install dependencies and build each workspace on a clean CI runner or deployment machine:

```bash
cd server
npm install --production
npm run build

cd ../client
npm ci
npm run build
```

If you deploy with Docker or PM2, prefer `npm ci` to ensure the lockfile is respected.

## 4. Run the services

### Using PM2

```bash
# From the repository root
pm2 start server/ecosystem.config.js
pm2 start client/ecosystem.config.js
```

### Using Docker Compose (example)

The Compose configuration is split into a production-like baseline (`compose.yml`) with optional overlays for development (`compose.dev.yml`) and deployment tweaks (`compose.prod.yml`). Run production with the base file and the production overlay:

```bash
docker compose --env-file env/prod.env -f compose.yml -f compose.prod.yml up -d
```

When running locally, opt in to the bundled MongoDB service by enabling the `local-db` profile and swapping to the development overlay:

```bash
docker compose --env-file env/dev.env -f compose.yml -f compose.dev.yml --profile local-db up
```

Adjust the configuration to match your orchestration platform. Remember to configure HTTPS termination at the load balancer or reverse proxy layer and to set `MONGO_URI` to an external database when the `local-db` profile is omitted.

## 5. Post-deployment checklist

- [ ] Confirm that the API can connect to MongoDB and Redis without errors.
- [ ] Verify that password reset and OTP emails are delivered successfully.
- [ ] Check that frontend pages load using the production API and refresh tokens as expected.
- [ ] Monitor logs during the first run of the subscription expiration job for locking conflicts.
- [ ] Update environment secrets periodically and rotate credentials when personnel changes occur.

## 6. Troubleshooting

| Symptom | Possible fix |
| --- | --- |
| `MongoNetworkError` on boot | Ensure the `MONGO_URI` host is reachable from the server and that the IP is allow-listed. |
| Authentication cookies not persisting | Confirm `NEXTAUTH_SECRET` is identical across all frontend instances and that the deployment is served over HTTPS. |
| OTP emails fail with TLS errors | Set `EMAIL_REQUIRE_TLS=false` temporarily or adjust `EMAIL_TLS_MIN_VERSION`/`EMAIL_TLS_CIPHERS` to match your provider. |
| Subscription job runs multiple times | Ensure `SUBSCRIPTION_JOB_LOCK_TTL_MS` exceeds the longest job duration and that each runner uses a unique `JOB_INSTANCE_ID`. |

With the environment configured and the services monitored, the application is ready for production traffic.
