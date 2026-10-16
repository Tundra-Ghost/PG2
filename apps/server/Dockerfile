# Game server image for Fly.io. Build context is the repo root (see fly.toml),
# because the server imports packages/game-core from the pnpm workspace.
FROM node:22-slim

WORKDIR /app
RUN corepack enable

# Manifests first so the dependency layer caches between deploys.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/game-core/package.json packages/game-core/
COPY game/package.json game/
RUN pnpm install --frozen-lockfile --filter @pigeon-chess/server...

COPY packages/game-core packages/game-core
COPY apps/server apps/server

ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["pnpm", "--filter", "@pigeon-chess/server", "start"]
