# PG2

Pigeon Chess Phase 0 prototype.

## What This Repo Is

This repository currently contains:

- A marketing/landing page at `index.html`
- A playable prototype app in `game/`
- Design documentation in `docs/`

The project vision is defined in the GDD and TDD:

- `docs/pigeon-chess-gdd.html`
- `docs/pigeon-chess-tdd.html`
- `docs/pigeon-chess-art-direction.html`
- `docs/pigeon-chess-modifier-bible-v02.html`

## Current Implementation

pnpm workspace (TDD §02 layout, web app kept at `game/` so the GitHub Pages URL keeps working):

- `packages/game-core`: pure TypeScript chess engine and modifier state machine. 5 shipped modifiers. No framework code.
- `apps/server`: Fastify + Socket.IO game server. Room codes, server-side move validation, seat reconnect. In-memory rooms.
- `game/`: React + Vite client. Local play vs `Chick` with the modifier draft, plus Online play against a friend (standard rules).

## Running It

Needs Node 20+ and pnpm (`corepack enable` once, or `npm i -g pnpm`).

```
pnpm install
pnpm dev            # web app at http://localhost:5173/PG2/game/dist/
pnpm dev:server     # game server at http://localhost:3001 (needed for Online)
pnpm test           # all packages
pnpm typecheck
```

To try online play, run both, open the web app in two tabs, create a room in one and join with the code in the other.

The live site (tundra-ghost.github.io/PG2/) is built and published by `.github/workflows/pages.yml` on every merge to main. Online play there uses the game server on Fly.io (`fly.toml`, `apps/server/Dockerfile`).

Deploying the server (one machine, since rooms live in memory):

```
fly auth login
fly apps create pg2-pigeon-chess   # first time only
fly deploy --ha=false
```

After that, `.github/workflows/deploy-server.yml` redeploys on every merge once the `FLY_API_TOKEN` repo secret is set (`fly tokens create deploy`).

## Repo Map

- `index.html`: landing page / product pitch
- `docs/`: GDD, TDD, art direction, modifier bible
- `packages/game-core/src/engine/`: chess rules and game loop
- `packages/game-core/src/modifiers/`: modifier data, registry, definitions
- `packages/game-core/src/net/`: wire format and Socket.IO protocol types
- `apps/server/src/`: rooms and socket wiring
- `game/src/components/`: gameplay and menu UI
- `game/src/online/`: client socket hook

## Working Rules

When making changes in this repo:

- Use the GDD for product/scope decisions
- Use the TDD for system architecture and implementation order
- Prefer TDD for engine and modifier work
- Game rules live in `packages/game-core` only. The client and server import them
- Keep large tasks split into small, testable increments

## Backlog

The active backlog lives in:

- `TODO.md`
- `docs/project-map.md`
