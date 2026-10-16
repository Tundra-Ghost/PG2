# Modifier Hook Model

This document translates the current prototype implementation into code-facing terms and maps it against the `TDD` hook pipeline and the shipped modifier set.

Primary references:

- `docs/pigeon-chess-tdd.html`
- `docs/pigeon-chess-modifier-bible-v02.html`
- `packages/game-core/src/modifiers/types.ts`
- `packages/game-core/src/engine/gameLoop.ts`
- `packages/game-core/src/engine/moveValidator.ts`

## Current Runtime Pipeline

The prototype does not yet match the server-authoritative `TDD` architecture, but the local runtime now follows the same hook order closely enough to treat it as the current contract for shipped modifiers.

Current move pipeline:

1. `beginTurn(state)`
2. `onTurnStart`
3. Player input builds a `Move`
4. `onPreMoveValidate`
5. Engine piece-movement validation
6. Tile validation stubs
7. `onPreMoveApply`
8. Self-check validation against the effective post-hook move
9. Board update via `applyMoveInternal`
10. `onCapture`
11. `onPromotion`
12. `onPostMove`
13. Turn switch and counters
14. Checkmate / stalemate / draw detection
15. `onTurnEnd`
16. `onTurnStart` for the next side if the game remains active
16a. Blocked-turn resolution: if modifiers leave the side to move with no valid move (and no Gerald to shoo), it is checkmate when in check, otherwise the turn is skipped. Two skips back to back is a stalemate draw.
17. `onMatchEnd` if the game ends
18. Move history / SAN recording

## Hook Semantics

### Owned cards drafted by both sides

- Both players may draft the same owned card, which adds two instances to `activeModifiers`.
- `onActivate` runs once per instance. Use `getModifierOwner` there to read the instance just added.
- Every other hook runs once per definition per event (`getActiveDefinitions`). Use `affectsColor` to check whether any instance applies to a side.

### `onActivate`

- Runs once when a drafted modifier is attached to `activeModifiers`.
- Used for match-start state setup, piece tagging, and initial board hazards.
- Current shipped users:
  - `MOD-A002` places initial lava tiles.
  - `MOD-B007` marks one pawn as pacifist.
  - `MOD-E006` marks one piece as the berserker.
  - `MOD-A006` marks the four centre tiles as Swamp.
  - `MOD-E002` rebuilds the owner's army as 12 pawns.

### `onTurnStart`

- Runs for the side whose turn is beginning.
- Appropriate for recurring hazards and turn-opening disruption.
- Current shipped users:
  - `MOD-A002` rotates lava on interval.
  - `MOD-B002` selects or persists Gerald's target.

### `onPreMoveValidate`

- Runs before piece legality and before self-check simulation.
- Only blocks or allows; it does not mutate the move.
- Current shipped users:
  - `MOD-B002` blocks Gerald-targeted pieces.
  - `MOD-A004` blocks frozen pieces.
  - `MOD-B007` blocks pacifist captures, including en passant.

### `onPreMoveApply`

- Runs after the move is structurally legal but before board mutation.
- May rewrite the move and/or mutate state.
- The runtime now validates self-check against the rewritten move, which is required for `TDD` safety.
- Current shipped users:
  - None yet.
- Regression coverage exists because this is a critical future hook for active abilities and rule-bending modifiers.

### `onCapture`

- Runs after the move is applied and capture state is known.
- Best for triggered follow-up captures or capture reactions.
- Current shipped users:
  - `MOD-E006` chains one additional legal capture at a time.

### `onPromotion`

- Runs after the promoted piece exists on the board.
- Best for preserving modifier state across promotion.
- Current shipped users:
  - `MOD-E006` preserves berserker status if the promoted piece was already the berserker.

### `onPostMove`

- Runs after the board is updated and after any capture/promotion reactions.
- Best for environmental cleanup or post-landing board effects.
- Current shipped users:
  - `MOD-A002` kills non-king pieces standing on lava.
  - `MOD-A004` applies freeze cooldown when a piece enters the frozen zone.

### `onTurnEnd`

- Runs after game-end detection.
- In current prototype semantics it receives a state whose `turn` already points to the next side, so modifiers that care about "who just moved" must use the incoming state carefully.
- Current shipped users:
  - `MOD-B002` decrements Gerald on the side that just ended its turn.
  - `MOD-A004` decrements freeze only for the side whose turn ended.

### `onMatchEnd`

- Runs only when the match transitions to a terminal state.
- The runtime now calls it from both `applyMove` and `passTurn`.
- Current shipped users:
  - None yet.
- Regression coverage exists so future end-of-match modifiers can rely on it.

## Implemented Versus TDD

### Aligned now

- Hook interface exists in `packages/game-core/src/modifiers/types.ts`.
- Runtime executes `onTurnStart`, `onPreMoveValidate`, `onPreMoveApply`, `onCapture`, `onPromotion`, `onPostMove`, `onTurnEnd`, and `onMatchEnd`.
- Self-check remains a non-bypassable engine rule even when `onPreMoveApply` rewrites a move.
- Modifier behavior is under test with focused engine and modifier suites.

### Still incomplete relative to TDD

- No shipped modifier currently uses `onPreMoveApply`.
- No shipped modifier currently uses `onMatchEnd`.
- Tile-effect validation is still a stub in `moveValidator.ts`.
- The prototype remains client-authoritative rather than shared-core/server-authoritative.

## Shipped Modifier Audit

### `MOD-A002` Floor Is Lava

Modifier-bible intent:

- Four lava tiles at match start.
- Any piece landing on lava dies, including friendly pieces.
- Rotates on interval.
- Telegraph/preview for next lava position.

Prototype status:

- Implemented: initial placement, rotation cadence, immediate post-move lava kills, event logging, empty-tile spawn safety.
- Prototype deviation:
  - Rotation cadence is every 3 turns, not every 10.
  - No preview/telegraph for next lava position.
  - Kings are explicitly exempt from lava death in current runtime.

Assessment:

- Mechanically playable and safe.
- Not modifier-bible complete.

### `MOD-A004` Winter Is Coming

Modifier-bible intent:

- Frozen home-zone rows.
- Entering frozen zone forces a full thaw turn.
- Pawns freeze before promoting.
- Frozen castle-path tiles block castling.

Prototype status:

- Implemented: ranks `1-3` and `6-8` are treated as frozen zones; entering a frozen zone from outside applies a freeze cooldown; frozen pieces are blocked for a full future turn; castling is blocked because castle-path tiles on frozen home rows are iced over.
- Prototype deviation:
  - Uses zone classification and validation rules rather than persistent per-tile frozen state objects.
  - No special-case promotion interaction beyond normal movement blocking.

Assessment:

- Core freeze behavior now matches the modifier-bible intent much more closely.
- Remaining gap is mostly presentation/state-model fidelity, not basic rules.

### `MOD-B002` Distracted Piece / Gerald

Modifier-bible intent:

- Gerald blocks one piece at the start of each cursed player's turn.
- Player can spend the turn to clear Gerald.
- Gerald keeps returning.
- Gerald should not create nonsense targeting.

Prototype status:

- Implemented: start-of-turn targeting, owned draft scoping, multi-turn persistence, move blocking, cooldown decay, non-king targeting, and board-level "click Gerald off and forfeit the turn" interaction.
- Prototype deviation:
  - No explicit leaderboard or UI interaction loop beyond cooldown behavior.
  - No special exclusion for future pigeon piece types yet.

Assessment:

- Good prototype implementation of the core interference mechanic.
- Missing the authored interaction layer promised by the modifier bible.

### `MOD-B007` Conscientious Objector

Modifier-bible intent:

- One pawn refuses captures permanently.
- Still moves, blocks, and promotes.
- Pacifism persists through promotion.

Prototype status:

- Implemented: one owned pawn becomes pacifist; normal movement remains legal; captures and en passant are blocked; pacifism persists through promotion because the promoted piece keeps the original piece flags.
- Prototype deviation:
  - No special visual treatment yet for promoted pacifist pieces.

Assessment:

- Core rule restriction is implemented and safe.
- Prototype behavior now matches the core modifier-bible rule.

### `MOD-E006` BOY. / The Berserker

Modifier-bible intent:

- A designated non-king piece chain-captures as long as legal captures remain.
- Title passes to another piece if captured.
- Termination condition must be explicit and safe.

Prototype status:

- Implemented: one owned piece becomes berserker; capture triggers one additional best-value legal chain capture; the title passes to a random surviving allied non-king piece if the current berserker is captured; state/event logging exists; promotion preserves berserker flag.
- Prototype deviation:
  - Current runtime executes one chained follow-up per trigger, not indefinite recursive chaining.
  - Lava interaction is indirect rather than explicitly modeled.

Safety note:

- The chain selector now skips follow-up captures that would leave the berserker side in check.

Assessment:

- Safe prototype slice of the mechanic.
- Not modifier-bible complete.

### `MOD-A006` This Is My Swamp

- A piece that starts its move on d4, d5, e4 or e5 moves only 1 square, captures included. Sliders may pass through.
- A knight landing in the Swamp is blocked for 2 of its turns, then leaps out normally.
- Deviation: Swamp pieces still give check at full range, because check detection is pure chess.

### `MOD-B008` 7/10 Too Many Pieces

- Reginald Beak posts a review event after every move by the owner. No gameplay effect.
- The match banner prefers any other event from the same move over Reginald.
- Deviation: about 30 lines so far; the bible asks for 150+.

### `MOD-E002` The Small Council

- Owner loses knights and bishops and gets 12 pawns: rank 3 (or 6) full, plus b, c, f and g on rank 2 (or 7).
- Third-rank pawns cannot double step.

### `MOD-E007` Reject Queen, Embrace Knight

- `onPreMoveValidate` refuses queen promotion for the owner. `getValidPromotionTypes` lists what is allowed; the bot, the board highlights, auto-queen and the promotion menu all use it.
- `onPromotion` gives the new piece `hasPromotionChain`. Its next capture chains one extra capture (same picker as the Berserker).

### `MOD-B006` They Were The Traitor

- From turn 21 (move 11), each owner turn start has a 25% chance to warn: the highest-value non-king piece gets `isTraitor`.
- At the owner's next turn start it changes colour. A home-corner rook takes its castling right with it. If the traitor was captured first, the search starts over. Once per match.

### `MOD-E004` Equivalent Exchange (The Chancellor)

- `onActivate` turns one random owner rook into `chancellor`. The move generator gives it rook plus knight moves, so check detection sees it too. Castling on that side is lost. SAN letter is `C`.

### `MOD-E005` Twin Telepathy

- `onPostMove`: after a bishop moves, each same-colour twin slides the same direction up to the same distance. It stops before pieces and void tiles, never captures, skips if it has any active cooldown, and shortens the slide until its own king is safe (or stays put).

### `MOD-A003` Vent Tiles

- `onActivate` hides 3 vents (`isVent`) on empty ranks 3 to 6, never opposite each other.
- `onPostMove`: the first non-king piece to land on a vent jumps to the point-reflected square and captures anything there. The vent becomes `isVoid`.
- `isVoid` tiles are off the board in the move generator: nothing lands on or slides through them. Future Storm can reuse this.
- The vent jams (stays hidden, piece stays) if the exit holds a king or the jump would expose the mover's king.

## Turn takeover

- `takeOverTurn(state)` lets a modifier play the side to move's turn for them. `applyMove` and `passTurn` call it after the turn begins and play the returned move through the full pipeline, so it can chain.
- Shipped: `MOD-B001` YOU DIED plays every 7th owner turn with a random valid move. The board flashes "A PIECE MOVED".

## Active abilities (category C)

- A definition with `ability` (see `AbilitySpec` in `modifiers/types.ts`) gives a piece type a button ability.
- It is played as a `Move` with `ability` set. `validateMove` runs the normal pre-move hooks (Gerald, frozen, pacifist, swamp), then `checkAbilityMove` (owner, piece type, cooldown, target), then the self-check guard on the ability's effect.
- `applyMove` skips `onPreMoveApply` for abilities, uses `ability.apply` (default: move to the target), then runs the usual capture, post-move and turn-end hooks.
- Cooldowns live in `piece.abilityCooldowns` and tick at the end of each own turn, passes included.
- The board shows an ability bar when the side has ability cards. The bot weighs ability moves on the same material score.
- Shipped: `MOD-C003` knight rook move (6), `MOD-C004` pawn backward capture (4), `MOD-C006` rook cannon (7, kings block the shot).

## Recommended Next Modifier Work

`TDD`-aligned next steps:

1. Keep engine legality non-negotiable and treat self-check as unoverrideable.
2. Add promotion-persistence for `MOD-B007`.
3. Decide whether `MOD-A004` should stay prototype-simplified or move toward real frozen-zone tiles.
4. Implement Gerald's "clear Gerald, lose turn" interaction if this card remains shipped.
5. Decide whether `MOD-E006` should remain "single extra chain" for prototype readability or move toward true indefinite chaining.
