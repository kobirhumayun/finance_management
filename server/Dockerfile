# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/uploads \
    && chown node:node /app/uploads

FROM base AS dependencies

COPY package*.json ./
RUN npm ci --omit=optional

FROM dependencies AS development

ENV NODE_ENV=development
COPY . .
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]

FROM dependencies AS production-dependencies

RUN npm prune --omit=dev \
    && npm cache clean --force

FROM base AS production

ENV NODE_ENV=production

COPY --chown=node:node package*.json ./
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=40s \
  CMD curl -fsS http://127.0.0.1:5000/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
