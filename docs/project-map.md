# Project Map

This file summarizes what is actually implemented in the repository today and where it diverges from the GDD/TDD.

## Product Identity

`Pigeon Chess` is presented as a roguelike chess game with modifier drafting, bird-themed narrative/UI, and a longer-term web + desktop ambition.

Primary product references:

- `docs/gdd.md`
- `docs/tdd.md`
- `docs/art-direction.md`
- `docs/modifier-bible.md`
- `docs/characters.md`
- `docs/modifier-hook-model.md`

## Top-Level Structure

- `index.html`
  - Marketing/landing page
- `docs/`
  - Product/design/technical source documents
- `game/`
  - Playable prototype app

## Implemented Prototype Surface

### App shell

- `game/src/App.tsx`
  - Screen flow: menu, bot select, draft, game, settings
  - Starts local matches directly in the client
  - Runs bot turns locally

### Chess core

- `packages/game-core/src/engine/ChessEngine.ts`
  - Public engine API
- `packages/game-core/src/engine/gameLoop.ts`
  - Move application, turn handling, draw logic
- `packages/game-core/src/engine/moveGenerator.ts`
  - Legal move generation support
- `packages/game-core/src/engine/moveValidator.ts`
  - Validation layer
- `packages/game-core/src/engine/types.ts`
  - Core state model

### Modifier system

- `packages/game-core/src/modifiers/data.ts`
  - Card catalog and UI-facing modifier metadata
- `packages/game-core/src/modifiers/registry.ts`
  - Runtime modifier registry
- `packages/game-core/src/modifiers/index.ts`
  - Registers active modifier definitions
- `packages/game-core/src/modifiers/definitions/`
  - Currently implemented definitions:
    - `berserker.ts`
    - `conscientious-objector.ts`
    - `floor-is-lava.ts`
    - `gerald.ts`
    - `winter-is-coming.ts`

### UI

- `game/src/components/MainMenu/`
  - Main menu and future-mode placeholders
- `game/src/components/DraftScreen/`
  - Modifier draft UI with budget rules
- `game/src/components/Board/`
  - Board rendering and move interaction
- `game/src/components/BotSelect/`
  - Bot selection UI
- `game/src/components/Settings/`
  - Audio, display, and gameplay settings

## What Appears Implemented Versus Planned

### Implemented now

- Local single-device play
- Quick play against the `Chick` bot
- Draft-based match start flow
- Partial modifier execution
- Basic settings and audio handling

### Planned in UI/docs but not complete

- Multiple bot tiers
- Ranked
- Casual online
- Modifier Vault
- The Roost / run history / stats
- Server-authoritative multiplayer architecture
- Broader roguelike meta-progression

## TDD/GDD Gap Review

### Gap 1: Runtime architecture

TDD target:

- Shared pure TypeScript game-core
- Server-authoritative rules
- Client renders emitted state only

Current repo (2026-10-15):

- Engine and modifiers live in `packages/game-core` (pnpm workspace)
- `apps/server` runs Fastify + Socket.IO rooms and validates every online move with game-core
- Online play (standard rules) renders server state only
- Local bot play and the modifier draft still run in the client
- Player accounts (username + password, Better Auth on SQLite) sync the local profile across devices; Clerk (P0-06) waits on a custom domain
- Still missing from the TDD stack: Redis/Postgres (P0-05), Phaser renderer (P0-04), Turborepo, draft over sockets (P1-03)

### Gap 2: Test discipline

TDD direction implies engine-first validation.

Current repo:

- Vitest is installed in `game/`
- Engine and modifier tests now cover core legality, draw rules, SAN edge cases, hook-pipeline regressions, and shipped modifier safety cases

This risk is materially lower than before, though more coverage is still useful as new modifiers land.

### Gap 3: Modifier completeness

Design set:

- 40 modifiers across 5 categories

Current repo:

- 5 registered runtime definitions
- A broader card catalog exists in data, but most cards are not implemented as behavior
- `docs/modifier-hook-model.md` now documents the implemented hook model and the shipped-modifier deviations from modifier-bible intent

### Gap 4: Feature ordering

TDD build order says not to race ahead on roguelike/store features before chess core and multiplayer stability.

Current UI already advertises future systems. The backlog should keep core-engine and modifier validation ahead of feature expansion.

## Recommended Build Order From Here

1. Add a test harness and cover engine rules
2. Add tests for the 5 implemented modifiers
3. Audit prototype behavior against TDD expectations
4. Decide whether to stay prototype-local or begin shared game-core extraction
5. Expand bots and content only after core behavior is stable
