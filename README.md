# PG2

Pigeon Chess Phase 0 prototype.

## What This Repo Is

This repository currently contains:

- A marketing/landing page at `index.html`
- A playable prototype app in `game/`
- Design documentation in `docs/`

The project vision is defined in the GDD and TDD:

- `docs/gdd.md`
- `docs/tdd.md`
- `docs/art-direction.md`
- `docs/modifier-bible.md`

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

Online games are saved after every move when `DATA_DIR` is set (a Fly volume in production), so a game can be resumed days later from the Your games list. Locally, with no `DATA_DIR`, games live in memory.

Players can create an account under Settings > Account (username + password, no email). Their profile, stats and titles then sync to the server and follow them to other devices. Accounts live in a SQLite file at `DB_PATH` (on the Fly volume in production) and need `BETTER_AUTH_SECRET` set; locally, with no `DB_PATH`, they live in memory and vanish when the server restarts.

Playtest feedback lands in the same database: players send notes from Settings > Feedback, and an optional survey follows each finished game. Read them on the server with:

```
fly ssh console -C "pnpm --filter @pigeon-chess/server feedback"          # open feedback
fly ssh console -C "pnpm --filter @pigeon-chess/server feedback surveys"  # survey summary
```

To try online play, run both, open the web app in two tabs, create a room in one and join with the code in the other.

The live site (tundra-ghost.github.io/PG2/) is built and published by `.github/workflows/pages.yml` on every merge to main. Online play there connects to the game server on Fly.io at `https://pigeon-chess-server.fly.dev` (`fly.toml`, `apps/server/Dockerfile`). The server deploys itself from `.github/workflows/fly-deploy.yml` when server code reaches main (needs the `FLY_API_TOKEN` repo secret); it can also be run by hand from the Actions tab, or with `fly deploy` from the repo root.

## Repo Map

- `index.html`: landing page / product pitch
- `docs/`: GDD, TDD, art direction, modifier bible
- `packages/game-core/src/engine/`: chess rules and game loop
- `packages/game-core/src/modifiers/`: modifier data, registry, definitions
- `packages/game-core/src/net/`: wire format and Socket.IO protocol types
- `apps/server/src/`: rooms, socket wiring, and accounts (`accounts.ts`)
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
