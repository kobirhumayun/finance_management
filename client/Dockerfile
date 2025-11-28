# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1 \
  NEXT_FONT_IGNORE_REMOTE_FONT_ERRORS=1 \
  NEXT_FORCE_WEBPACK=1 \
  NEXT_USE_TURBOPACK=0 \
  NEXT_TURBOPACK_USE_WORKER=0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  dumb-init \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

COPY package*.json ./
RUN npm ci

FROM dependencies AS development

ENV NODE_ENV=development
COPY . .
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]

FROM dependencies AS builder

COPY . .
RUN npm run build

FROM base AS production

ENV NODE_ENV=production \
  PORT=3000

# 1. Copy public assets
COPY --from=builder /app/public ./public

# 2. Copy the standalone folder
COPY --from=builder --chown=node:node /app/.next/standalone/app ./

# 3. Copy static assets (images, fonts, chunks)
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=40s \
  CMD curl -fsS http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]

# 4. Start the server directly (Do NOT use npm run start)
CMD ["node", "server.js"]