# Development Workflow

This document captures the day-to-day tasks required to work on the Finance Management application. It complements the environment variable references in `client/.env.example` and `server/.env.example`.

## 1. Prerequisites

- Node.js 18+
- npm 9+
- MongoDB 5.x running locally on `mongodb://localhost:27017`
- (Optional) Redis 6.x when you want to exercise the production-style auth session coordination from the frontend

After cloning the repository, install dependencies for each workspace:

```bash
cd server && npm install
cd ../client && npm install
```

## 2. Environment setup

1. Copy the example files:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env.local
   ```
2. Update the copied files with development-friendly values. Defaults already point to `localhost` services. Replace secrets such as `NEXTAUTH_SECRET`, `ACCESS_TOKEN_SECRET`, and `REFRESH_TOKEN_SECRET` with randomly generated strings (`openssl rand -hex 32`).
3. Ensure MongoDB is running: `mongod --config /usr/local/etc/mongod.conf` (or start the service through your package manager).
4. (Optional) Start Redis if you want to test token refresh coordination: `redis-server`.

## 3. Running the application

Open two terminals—one for the backend API and one for the frontend app.

### Backend API

```bash
cd server
npm run dev
```

This command launches Nodemon with hot reloading on `http://localhost:5000`. When adjusting JWT expiry constants or email templates, restart the server to ensure the values are reloaded from the environment.

### Frontend (Next.js)

```bash
cd client
npm run dev
```

Next.js runs on `http://localhost:3000` by default. The development server proxies API requests to the backend URL defined in `AUTH_BACKEND_URL`.

## 4. Database fixtures

- Seed scripts live in [`server/scripts/`](../server/scripts). Run `npm run seed` from the `server/` directory to populate reference data.
- Integration tests use an in-memory Mongo server configured in [`server/jest.setup.js`](../server/jest.setup.js). Keep this setup in mind when adding new collections so that tests initialize the fixtures they need.

## 5. Coding conventions

- **Frontend linting**: The client enforces rules defined in [`client/eslint.config.mjs`](../client/eslint.config.mjs). Run `npm run lint` inside `client/` before submitting changes.
- **API style**: Follow existing patterns in the Express controllers (see [`server/controllers`](../server/controllers))—validate input with `express-validator`, rely on services under [`server/services`](../server/services), and keep response payloads camelCased.
- **Module resolution**: The frontend uses aliases defined in [`client/jsconfig.json`](../client/jsconfig.json). Import components using the configured paths (e.g. `@/components/Button`).

## 6. Testing

| Workspace | Command | Notes |
| --- | --- | --- |
| Backend | `npm test` (from `server/`) | Uses Node's built-in test runner with supporting helpers under `server/tests`. |
| Frontend | `npm test` (from `client/`) | Runs Node's test runner alongside React Testing Library helpers. |
| Lint | `npm run lint` (from `client/`) | Ensures the Next.js workspace follows its lint rules. |

Automate these commands in CI by invoking the workspace scripts explicitly: `npm run --prefix server test`, `npm run --prefix client test`, etc.

## 7. Working with subscription plans

- Server-side plan logic lives in [`server/models/Plan.js`](../server/models/Plan.js) and [`server/services/planLimits.js`](../server/services/planLimits.js).
- Background jobs that downgrade expired users are implemented in [`server/jobs/subscriptionJobs.js`](../server/jobs/subscriptionJobs.js).
- Frontend components query the current plan through [`client/src/lib/queries/plans.js`](../client/src/lib/queries/plans.js) and consume the data in the `/app/(user)/my-plan` and `/app/(user)/summary` routes.

When you introduce or rename plan tiers, ensure the Plan model enumerations and any UI copy describing plan names stay in sync. The [`docs/plan-limits.md`](./plan-limits.md) reference describes the structure persisted in MongoDB.

## 8. Troubleshooting tips

| Symptom | Suggested fix |
| --- | --- |
| `MongoNetworkError` during development | Confirm MongoDB is running locally and the URI in `server/.env` is correct. |
| Password reset emails fail | Use a service like Mailhog locally by setting `EMAIL_HOST=localhost`, `EMAIL_PORT=1025`, and `EMAIL_SECURE=false`. |
| Next.js cannot reach the API | Verify that `AUTH_BACKEND_URL` points to the backend dev server and that CORS allows `http://localhost:3000`. |
| Redis connection refused | Either start Redis locally or leave `REDIS_URL` unset during development to fall back to in-memory session coordination. |

Keeping these practices in mind will ensure a smooth development experience across the monorepo.
