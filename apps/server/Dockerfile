# Game server image for Fly.io. Build from the repo root (fly.toml sets this).
FROM node:22-slim
WORKDIR /app
RUN corepack enable

# Workspace manifests first, so the install layer caches between deploys.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/game-core/package.json packages/game-core/
COPY apps/server/package.json apps/server/
COPY game/package.json game/
RUN pnpm install --frozen-lockfile --filter "@pigeon-chess/server..."

COPY packages/game-core packages/game-core
COPY apps/server apps/server

ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["pnpm", "--filter", "@pigeon-chess/server", "start"]
