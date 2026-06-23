# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/types/package*.json ./packages/types/
COPY packages/connectors/package*.json ./packages/connectors/
COPY packages/analytics/package*.json ./packages/analytics/

RUN npm ci

COPY . .
RUN npm run build

# Drop devDependencies before copying to the runner stage
RUN npm prune --omit=dev

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

# Chromium is needed for the DATAcube grocery-price scraper
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pruned node_modules (includes native addons compiled for this OS/arch)
COPY --from=builder /app/node_modules ./node_modules

# Workspace packages — manifests + compiled dist (node_modules symlinks point here)
COPY --from=builder /app/packages/types/package.json      ./packages/types/package.json
COPY --from=builder /app/packages/types/dist               ./packages/types/dist
COPY --from=builder /app/packages/connectors/package.json  ./packages/connectors/package.json
COPY --from=builder /app/packages/connectors/dist          ./packages/connectors/dist
COPY --from=builder /app/packages/analytics/package.json   ./packages/analytics/package.json
COPY --from=builder /app/packages/analytics/dist           ./packages/analytics/dist

# API compiled output
COPY --from=builder /app/apps/api/dist        ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# React build — served as static assets by NestJS
# (main.ts resolves this as path.resolve(__dirname, '../../web/dist'))
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Root manifest needed so npm workspace commands resolve correctly
COPY --from=builder /app/package.json ./package.json

# SQLite cache lives on a mounted volume
RUN mkdir -p /data

ENV PORT=3000
ENV CHROME_BIN=/usr/bin/chromium
ENV SQLITE_PATH=/data/cache.sqlite

EXPOSE 3000

# Run the compiled entry point directly — no npm indirection needed
CMD ["node", "apps/api/dist/main.js"]
