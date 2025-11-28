# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_FONT_IGNORE_REMOTE_FONT_ERRORS=1 \
    NEXT_FORCE_WEBPACK=1 \
    NEXT_USE_TURBOPACK=0 \
    NEXT_TURBOPACK_USE_WORKER=0

WORKDIR /app

FROM base AS builder

COPY package*.json ./
RUN npm ci \
  && npm cache clean --force

COPY . .
RUN npm run build \
  && npm cache clean --force

FROM base AS prod-deps

COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_FONT_IGNORE_REMOTE_FONT_ERRORS=1 \
    NEXT_FORCE_WEBPACK=1 \
    NEXT_USE_TURBOPACK=0 \
    NEXT_TURBOPACK_USE_WORKER=0

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/components.json ./components.json
COPY --from=builder /app/jsconfig.json ./jsconfig.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=40s \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "run", "start"]
