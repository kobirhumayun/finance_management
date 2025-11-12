# Environment presets

The files in this directory provide environment variable presets that can be passed to Docker Compose via the `--env-file` flag.

- Copy `dev.env.example` to `dev.env` when running the stack locally.
- Copy `prod.env.example` to `prod.env` (or create a secure variant in your deployment pipeline) when promoting to production.

Each preset only includes variables that are shared across services. Workspace-specific settings should continue to be managed via `client/.env.local` and `server/.env` to keep secrets scoped to the services that require them.
