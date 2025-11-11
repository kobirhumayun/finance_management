# Development Workflow

This guide outlines the day-to-day practices for contributing to the Finance Management application. The Docker workflow now mirrors production—both environments start from the shared Compose base located at `compose/base.yml`. Development-specific overrides live in `compose/development.yml`, while environment variables are sourced from the templates inside [`env/development`](../env/development).

## 1. Prerequisites

- Docker Engine 24+
- Docker Compose Plugin 2.20+
- (Optional) Managed MongoDB and Redis endpoints if you do not want to run the bundled containers

The containers provide all required runtimes, so you do not need local Node.js, MongoDB, or Redis installations unless you intentionally opt out of the stack services.

## 2. Environment setup

1. Duplicate the development templates and adjust secrets:
   ```bash
   cp env/common.env env/.env.local.common
   cp -r env/development env/.env.local.development
   ```
2. Edit the copies to match your environment (for example, set unique JWT secrets). The checked-in templates contain safe defaults and placeholders.
3. Update the `env_file` entries in `compose/development.yml` or export environment variables (`COMMON_ENV_FILE` and `DEVELOPMENT_ENV_DIR`) before running Compose so that containers load your private copies instead of the templates.

## 3. Running the application

Start every service—including MongoDB and Redis—through Docker Compose so the topology matches production:

```bash
docker compose \
  -f compose/base.yml \
  -f compose/development.yml \
  --profile stack \
  up
```

- The frontend runs on [http://localhost:3000](http://localhost:3000) with hot reloading enabled.
- The API runs on [http://localhost:5000](http://localhost:5000) via Nodemon.
- MongoDB (`27017`) and Redis (`6379`) expose host ports for connection from local tooling when you need direct access.

Use `docker compose ... down` to stop the stack and `docker compose ... logs -f <service>` to follow logs for a specific container. The included `Makefile` wraps these invocations (`make up`, `make down`, etc.) and passes the correct files and profiles for you.

## 4. Database fixtures

- Seed scripts live in [`server/scripts/`](../server/scripts). Execute them inside the running API container if they rely on containerized dependencies:
  ```bash
  docker compose -f compose/base.yml -f compose/development.yml exec finance-management-api npm run seed
  ```
- Integration tests use an in-memory Mongo server configured in [`server/jest.setup.js`](../server/jest.setup.js). Keep this setup in mind when adding new collections so that tests initialize the fixtures they need.

## 5. Coding conventions

- **Frontend linting**: The client enforces rules defined in [`client/eslint.config.mjs`](../client/eslint.config.mjs). Run `docker compose -f compose/base.yml -f compose/development.yml run --rm finance-management-web npm run lint` to lint inside the containerized environment.
- **API style**: Follow existing patterns in the Express controllers (see [`server/controllers`](../server/controllers))—validate input with `express-validator`, rely on services under [`server/services`](../server/services), and keep response payloads camelCased.
- **Module resolution**: The frontend uses aliases defined in [`client/jsconfig.json`](../client/jsconfig.json). Import components using the configured paths (e.g. `@/components/Button`).
- **Server linting**: The backend uses ESLint rules defined in [`server/.eslintrc.cjs`](../server/.eslintrc.cjs). Run `docker compose -f compose/base.yml -f compose/development.yml run --rm finance-management-api npm run lint` when changing API code.
- **Formatting**: Both workspaces share a Prettier configuration located at [`package.json`](../package.json). Execute `npm run format` from the repository root to apply consistent formatting.

## 6. Testing

| Workspace | Command | Notes |
| --- | --- | --- |
| Backend | `docker compose -f compose/base.yml -f compose/development.yml run --rm finance-management-api npm test` | Uses Node's built-in test runner with helpers under `server/tests`. |
| Frontend | `docker compose -f compose/base.yml -f compose/development.yml run --rm finance-management-web npm test` | Runs Node's test runner alongside React Testing Library helpers. |
| Lint | `docker compose -f compose/base.yml -f compose/development.yml run --rm finance-management-web npm run lint` / `docker compose -f compose/base.yml -f compose/development.yml run --rm finance-management-api npm run lint` | Ensures ESLint rules pass in the relevant workspace. |
| Type checks | `docker compose -f compose/base.yml -f compose/development.yml run --rm finance-management-web npm run typecheck` | Validates the Next.js TypeScript types. |

Automate these commands in CI by invoking the workspace scripts through Docker Compose to replicate the containerized environment.

## 7. Git workflow tips

- Create feature branches off `main` for each change. Use descriptive names such as `feature/report-export`.
- Keep commits focused and include a summary of the motivation in the commit message body when necessary.
- Open a pull request when the branch is ready and ensure CI passes before requesting review.
- When addressing review feedback, prefer follow-up commits over force pushes so reviewers can track incremental changes.

## 8. Troubleshooting tips

| Symptom | Suggested fix |
| --- | --- |
| `MongoNetworkError` during development | Confirm MongoDB is running in the container (`docker compose ... ps`) and that the URI in `env/development/database.env` matches the service name. |
| Password reset emails fail | Point the email settings to a local SMTP sink (e.g. Mailhog) by editing `env/development/server.env`. |
| Next.js cannot reach the API | Verify that `AUTH_BACKEND_URL` in `env/development/client.env` points to the API service and that CORS allows `http://localhost:3000`. |
| Redis connection refused | Start the stack with the `stack` profile or update `env/development/client.env` to point at your external Redis instance. |

Keeping these practices in mind will ensure a smooth development experience across the monorepo.
