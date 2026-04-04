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
- In-game history now supports modifier events, local match chat, and simple bot reaction lines in one merged feed
- Bot reaction dialogue is now split into a code-level module so Chick can expand without bloating the app shell
- Opponent speaker metadata and reaction personas are now separated from UI components, which keeps future bots and NPCs viable
- Prototype app and landing page now have an explicit mobile-responsive baseline
- In-match UI now separates the primary play surface from the modifier rail and supports collapsible modifier browsing
- New Run now follows bot select -> alternating draft -> match start, with owned vs shared modifier rules enforced during draft
- Curse modifiers now respect draft ownership instead of always behaving as shared effects
- Local player profile state and basic progression stats are now stored client-side for the serverless prototype
- Local profiles now track titles, achievements, match history, mode stats, region, and placeholder ELO entirely on-device
- The Roost can now serve as a real local records destination instead of a menu placeholder

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
- [x] Add a draft filter to hide unavailable modifiers during modifier testing
- [ ] Track implementation status per shipped modifier: engine logic, board visuals, interaction feedback, tests
- [ ] Build an implementation checklist for the remaining 35 modifiers by category
- [x] Slow down Gerald and lava cadence to improve readability in the shipped prototype

## Priority 3: Close TDD/GDD Gaps

- [ ] Decide whether the next milestone remains a local prototype or begins migration to server-authoritative play
- [ ] If migrating, extract pure game logic into a shared package boundary
- [ ] Define the smallest viable multiplayer slice before building ranked/casual systems
- [ ] Reconcile current menu promises with actual scope so the prototype does not over-claim

## Priority 4: Expand Playable Surface Area

- [ ] Add more bot tiers beyond `Chick`
- [x] Route New Run through bot select before draft and show bot-owned draft picks
- [x] Scope drafted curses to the side that selected them while preserving true shared modifiers
- [x] Add a local-only player profile flow for the current serverless prototype
- [x] Track local-only progression basics: runs played, wins, favorite drafted modifier
- [x] Expand local profiles with titles, achievements, mode stats, match history, and placeholder online sections
- [x] Turn The Roost into a real local records/profile destination
- [x] Rework Story draft into alternating player-first picks with early finish support
- [x] Classify prototype modifiers by draft scope so owned effects can be drafted by both sides
- [ ] Build `VS Bots` as a complete menu-to-match flow
- [ ] Expose a read-only Modifier Vault sourced from the modifier bible/data set
- [ ] Track run state if Story Mode is meant to be more than a one-match draft

## Priority 4A: UI, VFX, And SFX Readability

- [ ] GDD UI: replace temporary letter badges with authored icon badges for Gerald, lava, freeze, pacifist, and berserker states
- [ ] GDD UI: animate modifier triggers on board and pieces: lava burn, Gerald fly-off, freeze thaw, berserker chain, pacifist refusal
- [ ] GDD UI: add short event banners for autonomous or curse-driven actions so modifier outcomes never feel silent
- [x] GDD UI: route modifier-trigger messages into the in-game history feed
- [x] GDD UI: separate match log from modifier browsing so the board surface reads more clearly
- [x] GDD UI: merge local chat and move history into one in-match feed with typewriter-style bot/player delivery
- [x] GDD UI: restore explicit bot icon presence in the match HUD/feed so dialogue reads as authored speaker output
- [x] GDD UI: move opponent identity and reaction metadata into shared data modules instead of component-local constants
- [x] GDD UI: show modifier hover and long-press tooltips for affected pieces and tiles
- [x] GDD UI: restructure the in-match HUD into top banners, a framed board stage, and bottom dock panels
- [x] GDD UI: restructure the main menu into a hub layout that scales consistently across desktop resolutions
- [x] GDD UI: establish named art-slot regions in the main menu for future illustration drops
- [ ] GDD UI: add a shared icon set for modifier categories, settings controls, and board hazards
- [ ] GDD SFX: add distinct one-shot sounds for lava death, Gerald interference, freeze block, pacifist refusal, and berserker chain
- [ ] GDD SFX: add subtle UI sounds for draft select/deselect, disabled-card hover, modal open/close, and settings toggles
- [ ] GDD polish: review current emoji and placeholder symbols in the app shell against the art-direction doc and replace where needed
- [x] GDD UI: establish a mobile-responsive baseline for the landing page and playable prototype

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
