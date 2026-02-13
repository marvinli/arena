# ── Stage 1: install all deps (dev + prod) for building ──────
FROM node:20-slim AS deps
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY packages/proctor-api/package.json packages/proctor-api/
COPY packages/front-end/package.json packages/front-end/
# Stub out other workspaces so npm ci doesn't fail
COPY packages/videographer/package.json packages/videographer/
COPY packages/deploy/package.json packages/deploy/
COPY packages/admin-api/package.json packages/admin-api/
COPY packages/admin-fe/package.json packages/admin-fe/

RUN npm ci

# ── Stage 2: build front-end ─────────────────────────────────
FROM deps AS build-frontend
WORKDIR /workspace

COPY packages/front-end/ packages/front-end/
COPY tsconfig.json ./

# Vite reads env from envDir (repo root) — write .env for Vite to pick up
ARG OPENAI_API_KEY=""
RUN echo "OPENAI_API_KEY=$OPENAI_API_KEY" > .env

RUN npm run build -w @arena/front-end

# ── Stage 3: build proctor-api ───────────────────────────────
FROM deps AS build-api
WORKDIR /workspace

COPY packages/proctor-api/ packages/proctor-api/
COPY tsconfig.json ./

RUN npm run build -w @arena/proctor-api

# ── Stage 4: production deps only ────────────────────────────
FROM node:20-slim AS prod-deps
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY packages/proctor-api/package.json packages/proctor-api/
COPY packages/front-end/package.json packages/front-end/
COPY packages/videographer/package.json packages/videographer/
COPY packages/deploy/package.json packages/deploy/
COPY packages/admin-api/package.json packages/admin-api/
COPY packages/admin-fe/package.json packages/admin-fe/

RUN npm ci --omit=dev

# ── Stage 5: runtime ─────────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends nginx curl \
    && rm -rf /var/lib/apt/lists/*

# Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Front-end static assets
COPY --from=build-frontend /workspace/packages/front-end/dist/ /usr/share/nginx/html/

# Proctor-api built output + production node_modules
WORKDIR /app
COPY --from=build-api /workspace/packages/proctor-api/dist/ ./dist/
COPY --from=prod-deps /workspace/node_modules/ ./node_modules/
# Note: proctor-api deps are hoisted to root node_modules by npm workspaces

# Copy the proctor-api package.json (needed for ESM resolution)
COPY packages/proctor-api/package.json ./package.json

# Create data directory for SQLite
RUN mkdir -p /data

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=4001
ENV DB_PATH=/data/arena.db

EXPOSE 80

CMD ["/entrypoint.sh"]
