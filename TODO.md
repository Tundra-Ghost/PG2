# TODO

This backlog is ordered against the current repo state and the intended GDD/TDD direction.

## Current State

- Phase 0 prototype is playable locally in `game/`
- Architecture is client-side today
- TDD target architecture is server-authoritative shared game-core
- 5 modifier definitions are registered, while the modifier bible defines 40 cards
- Vitest is now installed in `game/` and baseline engine tests are passing
- Modifier audit is in progress to make currently shipped cards visible and testable in play
- In-game history now supports modifier event messages in addition to SAN move notation

## Priority 1: Stabilize The Prototype Core

- [x] Add a test runner for `game/` and create the first engine test suite
- [ ] Cover TDD-critical chess rules with tests: move legality, check, checkmate, stalemate, castling, en passant, promotion
- [ ] Add deterministic tests for draw logic: threefold repetition, 50-move rule, insufficient material
- [ ] Audit engine state transitions in `game/src/engine/gameLoop.ts` against the TDD move-validation pipeline
- [ ] Confirm current modifier hooks do not break core chess legality

## Priority 2: Formalize Modifier Architecture

- [ ] Document the implemented hook model in code-facing terms
- [ ] Add tests for the 5 currently registered modifiers
- [ ] Verify the existing 5 modifiers match their modifier-bible intent
- [ ] Separate shipped modifiers from design-only modifiers in the UI/data layer
- [ ] Track implementation status per shipped modifier: engine logic, board visuals, interaction feedback, tests
- [ ] Build an implementation checklist for the remaining 35 modifiers by category

## Priority 3: Close TDD/GDD Gaps

- [ ] Decide whether the next milestone remains a local prototype or begins migration to server-authoritative play
- [ ] If migrating, extract pure game logic into a shared package boundary
- [ ] Define the smallest viable multiplayer slice before building ranked/casual systems
- [ ] Reconcile current menu promises with actual scope so the prototype does not over-claim

## Priority 4: Expand Playable Surface Area

- [ ] Add more bot tiers beyond `Chick`
- [ ] Build `VS Bots` as a complete menu-to-match flow
- [ ] Expose a read-only Modifier Vault sourced from the modifier bible/data set
- [ ] Track run state if Story Mode is meant to be more than a one-match draft

## Priority 4A: UI, VFX, And SFX Readability

- [ ] GDD UI: replace temporary letter badges with authored icon badges for Gerald, lava, freeze, pacifist, and berserker states
- [ ] GDD UI: animate modifier triggers on board and pieces: lava burn, Gerald fly-off, freeze thaw, berserker chain, pacifist refusal
- [ ] GDD UI: add short event banners for autonomous or curse-driven actions so modifier outcomes never feel silent
- [x] GDD UI: route modifier-trigger messages into the in-game history feed
- [ ] GDD UI: add a shared icon set for modifier categories, settings controls, and board hazards
- [ ] GDD SFX: add distinct one-shot sounds for lava death, Gerald interference, freeze block, pacifist refusal, and berserker chain
- [ ] GDD SFX: add subtle UI sounds for draft select/deselect, disabled-card hover, modal open/close, and settings toggles
- [ ] GDD polish: review current emoji and placeholder symbols in the app shell against the art-direction doc and replace where needed

## Priority 5: Product Hygiene

- [ ] Keep `README.md` aligned with the actual repo state
- [ ] Keep this backlog updated after every substantial change
- [ ] Mark tasks with explicit TDD or GDD linkage during implementation

## Recommended Next Slice

TDD-first smallest useful slice:

1. Add a test runner
2. Lock down chess-engine behavior with core rule tests
3. Add tests for the 5 implemented modifiers
4. Then expand features
