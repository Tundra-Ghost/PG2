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

The playable app in `game/` is a React + TypeScript + Vite prototype with:

- A local custom chess engine
- A draft screen for modifier selection
- A playable board, move history, and settings flow
- One playable bot (`Chick`)
- A partial modifier system with 5 registered modifier definitions

The current implementation is a client-side Phase 0 prototype. It does not yet match the TDD target architecture for server-authoritative gameplay.

## Repo Map

- `index.html`: landing page / product pitch
- `docs/`: GDD, TDD, art direction, modifier bible
- `game/`: prototype client app
- `game/src/engine/`: chess rules and game loop
- `game/src/modifiers/`: modifier data, registry, definitions
- `game/src/components/`: gameplay and menu UI

## Working Rules

When making changes in this repo:

- Use the GDD for product/scope decisions
- Use the TDD for system architecture and implementation order
- Prefer TDD for engine and modifier work
- Keep large tasks split into small, testable increments

## Backlog

The active backlog lives in:

- `TODO.md`
- `docs/project-map.md`
