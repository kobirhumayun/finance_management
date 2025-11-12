# Environment file layout

Environment variables are managed through per-environment `.env` files stored in this directory. Copy the appropriate sample and fill in secrets for your target environment:

```bash
cp env/dev.env.example env/dev.env
cp env/prod.env.example env/prod.env
```

The root `.gitignore` excludes `env/*.env` so that real secrets never leave your machine. `docker compose` commands select the context-specific configuration using the `--env-file` flag:

```bash
# Development with the local MongoDB profile enabled
docker compose --env-file env/dev.env -f compose.yml -f compose.dev.yml --profile local-db up

# Production-like deployment using managed dependencies
docker compose --env-file env/prod.env -f compose.yml -f compose.prod.yml up -d
```

Adjust the values in each environment file to point at the services (MongoDB, Redis, SMTP) appropriate for that stage. The `local-db` profile controls whether the bundled MongoDB container starts; omit `--profile local-db` when connecting to an external database.
