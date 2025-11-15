# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        dumb-init \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        wget \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /ms-playwright

FROM base AS dependencies

COPY package*.json ./
RUN npm ci \
    && npx playwright install chromium

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
COPY --from=production-dependencies --chown=node:node /ms-playwright /ms-playwright
COPY --chown=node:node . .

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=40s \
  CMD curl -fsS http://127.0.0.1:5000/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
