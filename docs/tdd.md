# Pigeon Chess: Technical Design Document

**Ref:** PC-TDD-001 · **Version:** 0.2 · **Status:** Draft
**Related:** [GDD](gdd.md) · [Modifier Bible](modifier-bible.md) · [Art Direction](art-direction.md) · [Hook model](modifier-hook-model.md) · [Project map](project-map.md)

## Change log

**v0.2 (2026-10-30)**
- Converted from HTML to Markdown.
- Section 1 now shows what is built, what is still planned, and what changed. Several "locked" choices changed in practice (auth, hosting, monorepo tooling).
- Phaser 3 stays the plan for the board. The board is React/DOM today.
- Closed the "chess.js vs custom engine" decision: custom engine is built.
- New principle: offline modes run game-core in the browser. Online games are checked by the server.
- Section 4 now points to the [hook model](modifier-hook-model.md) as the exact contract, including `onTurnEnd` timing.
- Fixed the Madness formula, the table count, and a typo in the cosmetics table.
- Build order replaced by current status and next steps.

**v0.1** First draft.

## 1. Stack decisions

Three constraints from the GDD: solo or tiny team, web first with a Steam wrapper, and rules that can be checked on a server.

| Layer | Decision | Status |
|---|---|---|
| Frontend | React 18 + TypeScript 5 (strict) | **Built** |
| Board renderer | **Phaser 3**, inside a React component | **Planned.** The board is React + CSS today. See 1.1. |
| Chess engine | Custom TypeScript engine in `packages/game-core` | **Built.** chess.js was never used. |
| Backend | Node.js + Fastify | **Built** (`apps/server`) |
| Real-time | Socket.IO 4 | **Built** |
| Game storage | File store on a server disk (one file per room) | **Built.** Postgres + Redis are the long-term plan. |
| Auth | Better Auth, username + password, SQLite | **Built.** Replaced Clerk for playtesting. OAuth (Google, Discord, Steam) later. |
| ORM | Prisma | Planned, with Postgres |
| Hosting | Fly.io was used | **Paused** (trial ended 2026-10-23). Online play is on hold. |
| Web hosting | GitHub Pages, built by GitHub Actions on every merge | **Built** |
| Monorepo | pnpm workspaces | **Built.** Turborepo not added. |
| Tests | Vitest, GitHub Actions CI | **Built** |
| Steam wrapper | Tauri 2 | Planned |

### 1.1 Board renderer: Phaser plan

Phaser 3 remains the target for the board, tile effects, particles and animated pieces. The current React board is the reference for rules and layout. Migration notes:

- The board renders from `GameState` only. It never decides legality. This stays true after the move to Phaser.
- All piece drawing goes through one component (`game/src/components/Piece`). Phaser will replace this layer, so sprite sheets drop in at one place.
- Board events (`GameEvent` with `squares`) already drive flashes. Phaser effects should subscribe to the same events.
- Keep React for menus, draft, panels and dialogue.
- Mobile layout must keep working (the board fills the phone width today).

### 1.2 Open decisions

**Anti-cheat depth.** Online moves are checked on the server. Beyond that: report-and-review at launch. Engine comparison only after there is data, since modifiers make engine comparison unreliable.

**When to resume online hosting.** Needs a paid host. Decide when there are playtesters to serve.

## 2. System architecture

### Principle

The chess engine and all modifiers are pure TypeScript in `packages/game-core`, with no framework code.

- **Offline modes** (New Run, VS Bots, Practice, Standard chess) run game-core in the browser. Bots think in a Web Worker so the board never freezes.
- **Online games** run game-core on the server. The server checks every move and sends the new state. The client only renders it.

Same code in both places, so rules never differ between offline and online.

### Layers

```
CLIENT (game/)
  React app
  ├── Board (React today, Phaser later)   rendering, effects
  ├── Draft screen                         card picks
  ├── Menus, profile, settings, friends
  ├── Bot worker                           runs game-core bots off the main thread
  └── Socket.IO client                     online rooms

TRANSPORT
  Socket.IO   moves, draft, chat, state
  HTTPS       accounts, feedback, surveys

SERVER (apps/server)
  Fastify
  ├── Accounts (Better Auth)
  ├── Rooms (create, join, draft, moves, resign, draw)
  ├── game-core (all move checks)
  ├── Social (friends, messages, challenges)
  └── Feedback and surveys

DATA
  Room files on disk, SQLite for accounts
  Later: Redis (live games, queues), Postgres (users, matches, runs)
```

### Package layout (actual)

```
PG2/
├── game/                    web app (React). Stays here because Pages serves /PG2/game/dist/
├── apps/server/             Fastify + Socket.IO
├── packages/game-core/
│   └── src/
│       ├── engine/          moves, validation, check, draws, bots, PRNG
│       ├── modifiers/       card data, definitions, registry
│       ├── draft/           draft rules (budget, caps, turn model)
│       └── net/             wire format and socket protocol
├── docs/                    design docs (this file)
├── index.html               landing page
└── pnpm-workspace.yaml
```

Planned additions: `apps/desktop` (Tauri), `packages/elo` (Glicko-2), `prisma/`.

## 3. Chess engine

`packages/game-core/src/engine` is the only source of truth for move legality.

### Core types (summary)

The real types are in `packages/game-core/src/engine/types.ts`. Key points:

- `Square` is a string like `e4`.
- `Piece` has `type`, `color`, and per-modifier `cooldowns`. Flags exist for pacifist, berserker and so on.
- `TileState` holds tile effects (lava, swamp, storm `isVoid`, vents, no-fly lines).
- `GameState` holds pieces, tiles, `turn`, `turnNumber`, `activeModifiers`, `modifierState`, move and event history, `status`, `flags`, position history for threefold, `prngSeed` and `prngState`, Madness, tempo and mercenary tokens.
- `status` is `'draft' | 'active' | 'checkmate' | 'draw' | 'resigned' | 'abandoned'`.
- `Move` may carry `ability` (C cards) or `extraTurn` (tempo token).

Planned piece types: `pigeon` (E001). The Chancellor and Royal Guards are built.

### Move validation pipeline

Every move goes through these stages. In online games this runs on the server.

1. **Structure.** Right side to move, game active, a piece on the source square.
2. **Ownership.** The piece belongs to the mover.
3. **Pre-move hooks.** Modifiers may block or change the move (Gerald, Swamp, pacifist).
4. **Piece movement.** Engine or modifier move rules.
5. **Tile checks.** Storm, no-fly lines, vent shafts.
6. **Self-check guard.** Always runs. No modifier can skip it.

### King safety rules

Hard-coded. No modifier can override them.

1. A move that leaves or puts the real King in check is illegal.
2. The real King cannot be targeted by Traitor, Rook Cannon, The Snap, lava, storm or gravity.
3. Checkmate only counts against the real King. Royal Guards do not count.
4. Sus (D005) cannot disguise the real King.
5. Moneyball drops are checked at stage 6 and may not give check.
6. **Check uses normal movement,** even when a modifier stops the attacker from moving.
7. **No legal moves:** if modifiers block every move, the side in check is checkmated, otherwise the turn is skipped. Two skips in a row is a draw. See `resolveBlockedTurn` in `gameLoop.ts`.

## 4. Modifier state machine

Every modifier is a self-contained object that registers hooks. New modifiers are added as a new file under `modifiers/definitions/` plus a card in `modifiers/data.ts`. No engine changes needed in the normal case.

**The exact hook order and semantics are in [modifier-hook-model.md](modifier-hook-model.md).** That file is kept up to date with the code. This section is a summary.

### Definition interface (summary)

```ts
interface ModifierDefinition {
  id: ModifierID;              // 'MOD-A002'
  name: string;                // must equal the card name (test enforced)
  category: 'A' | 'B' | 'C' | 'D' | 'E';
  pointCost: number;           // must equal the card cost (test enforced)
  curseRating: 0 | 1 | 2 | 3;  // must equal the card curse (test enforced)
  draftScope: 'shared' | 'owned';
  ability?: AbilitySpec;       // C cards
  onActivate?, onTurnStart?, onPreMoveValidate?, onPreMoveApply?,
  onCapture?, onPromotion?, onPostMove?, onTurnEnd?, onMatchEnd?,
  takeOverTurn?                // plays a move for a side (YOU DIED)
  getVisibleSquares?           // planned, fog cards
}
```

The card in `data.ts` is what the draft and UI read. It also carries `prototypeRules`, the plain-language rules shown to players. Every registered card must have it.

### Hook order per move

1. `onTurnStart` for the side to move (Gerald lands, storm and lava timers)
2. Player input (move or ability)
3. `onPreMoveValidate` (can block or transform)
4. Engine validation + self-check guard
5. `onPreMoveApply` (teleports, slides)
6. Board update
7. `onCapture`, then `onPromotion`, then `onPostMove` (chains, twin bishop)
8. Turn switch
9. Check, checkmate and draw detection
10. `onTurnEnd`
11. Blocked-turn resolution for the next side
12. `onMatchEnd` if the game ended

**Timing trap:** `onTurnEnd` receives a state where `turn` already points to the next side. A modifier that cares about who just moved must use the other colour. See the hook model doc.

### Randomness

All modifier randomness uses the seeded PRNG (`engine/prng.ts`, `prngState` on `GameState`).

**Known debt:** the bots and the random draft still use `Math.random`. Bot tie-breaks and `runRandomDraft` should move to the game PRNG before replays ship.

## 5. Real-time layer

*Built. Hosting paused.*

Each online game is a Socket.IO room. The wire format and events are in `packages/game-core/src/net`.

| Event | Direction | Notes |
|---|---|---|
| room:create / join | Client → Server | Optional draft mode at creation |
| draft:pick / draft:finish | Client → Server | Server enforces draft rules from game-core |
| move | Client → Server | Server validates, applies, broadcasts |
| state | Server → Client | After every change |
| resign, draw offer / response | Both | |
| chat | Both | Saved with the game |
| friends, messages, challenges | Both | Social layer |

### Fog filtering (planned)

When fog cards are built, the server must compute visible squares per player and strip hidden pieces before sending state. A player must never receive a hidden piece, even as unused data. Offline vs a bot, the client hides them in the view only (the bot is not a cheat risk).

### Reconnects and timeouts

| Case | Today | Planned |
|---|---|---|
| Saved (untimed) game, player leaves | Game waits. Never forfeits for being away. Expires after 14 idle days. | Same |
| Live timed game, disconnect | Not built | Clock runs. 30 s reconnect window, then forfeit. |
| Disconnect during draft | Draft state is saved | 30 s window, then auto-pick |
| Server restart | Rooms reload from disk | Redis-backed |

## 6. Database schema (planned)

Planned for Postgres with Prisma. 11 tables:

| Table | Holds |
|---|---|
| users | account id, username, avatar, created, banned |
| ratings | Glicko-2 rating, deviation, volatility per mode and season (default 1200 / 350) |
| matches | players, mode, time control, result, modifiers, PGN, seed, event log, rating changes |
| roguelike_runs | tower, node map, current node, loadout, relics, Feathers, status |
| modifier_unlocks | which cards a user has, and how they got them |
| meta_progression | Prestige Tokens, tree nodes, Viktor level |
| puzzles | creator, start state, modifiers, goal, difficulty, review status, votes, stats |
| cosmetics | type, name, price, creator (null = official), asset URLs |
| user_cosmetics | ownership and equipped flag |
| battle_pass_progress | season, tier, XP, premium flag, claimed rewards |
| modifier_stats | picks, wins, bans, win rate per card, season and mode |

Madness is not stored. It is computed from active modifiers.

## 7. Matchmaking (planned)

A loop every 2 s pairs queued players by rating. The search range starts at ±100 and grows by 25 every 10 s, up to ±400. Queues live in Redis.

### Bots

| Tier | Name | Status | How it works |
|---|---|---|---|
| Easy | Chick | **Built** | 1-ply with material evaluation. Ignores modifiers. |
| Medium | Pigeon | **Built** | 3-ply alpha-beta through the full rules, so it sees lava and uses abilities. 900 ms budget. |
| Hard | Magnus | Planned | Deeper search with a modifier-aware evaluation. Stockfish cannot see modifiers, so it may only help in standard chess. |

Bots run in a Web Worker in the browser. A server bot is only needed for online bot play.

## 8. Replay system (planned)

Every match should be stored as a seed plus an ordered event list. Feeding the events back through game-core rebuilds any position. Uses: replays, puzzle creation, anti-cheat review, highlight clips.

Event types: `MOVE`, `ABILITY_USED`, `MODIFIER_TRIGGER`, `PIECE_DEFECTED`, `GERALD_LANDS`, `STORM_SHRINKS`, `VENT_TRIGGERED`, `PROMOTION`, `TURN_SKIPPED`, `DRAW_OFFER`, `RESIGN`, `GAME_END`.

**Determinism rules**
- All randomness from the seeded PRNG (see the known debt in section 4).
- Modifiers read only `GameState` and the event. No clock or network reads.
- Replays must match the original game exactly at every move.

`GameState.eventHistory` already records modifier events for the match feed. It is a starting point, not yet a full replay log.

## 9. Roguelike systems (planned)

### Run states

| State | What happens | Next |
|---|---|---|
| RUN_START | Map generated, starting modifier given, Feathers 0 | NODE_SELECT |
| NODE_SELECT | Player picks the next node | MATCH, EVENT, SHOP, REST, BOSS |
| IN_MATCH | Match runs | Win: NODE_COMPLETE. Loss: RUN_LOST. |
| IN_EVENT | 2 or 3 choices | NODE_COMPLETE |
| IN_SHOP | Buy or sell modifiers and relics | NODE_COMPLETE |
| IN_REST | Remove one curse OR preview the next loadout | NODE_COMPLETE |
| NODE_COMPLETE | Feathers awarded, Madness updated | NODE_SELECT |
| TOWER_CLEAR | Boss beaten. Prestige Tokens. Tower 5 = RUN_WON. | |
| RUN_LOST / RUN_WON | Tokens awarded, run archived | |

### Node map

8 rows, up to 3 paths wide, seeded. Match 60%, Event 15%, Shop 15%, Rest 10%. Row 1 is always a match. Row 4 is always a shop. Row 8 is the boss. No two rests in a row. Each node links to 1 to 3 nodes in the next row.

### Madness

```ts
function computeMadness(active: ModifierCard[]): number {
  const totalCurse = active.reduce((sum, m) => sum + m.curseLevel, 0);
  return Math.min(100, totalCurse * 10);
}
```

All categories count, since many non-curse cards have a curse rating. With max 5 cards a heavy curse loadout reaches about 100.

| Madness | State |
|---|---|
| 0 to 25 | Composed. Normal. |
| 26 to 50 | Unsettled. Minor glitches. |
| 51 to 75 | Unravelling. Pigeon shadows. |
| 76 to 99 | Lost. Hidden modifiers unlock. |
| 100 | Full Flock. Secret modifier triggers. |

## 10. Accounts

**Today:** Better Auth with username and password, stored in SQLite on the server disk. Password reset uses a one-time recovery code. Profiles sync to the account. Online seats belong to accounts. Offline play keeps a local profile on the device.

**Later:** OAuth (Google, Discord, Steam). Socket connections authenticate in the handshake. Guests can play offline modes. Online multiplayer needs an account.

## 11. Steam / Tauri (planned)

The desktop build wraps the web app in Tauri 2 (Windows and macOS). Offline modes work without a server, because game-core runs on the client. Online play uses the same server as the web.

| Feature | Plan | Phase |
|---|---|---|
| Steam login | Steam OpenID through the auth provider | Launch |
| Achievements | Steam SDK plugin, fired on match events | Launch |
| Cloud saves | Run state to Steam Cloud, backup on the server | Launch |
| Overlay | Steam SDK default | Launch |
| Workshop | Community cosmetics and puzzles | Post-launch |
| Trading cards | Pigeon companions and modifiers | Post-launch |

Window: 1280×800 default, minimum 1024×640, resizable.

## 12. Status and next steps

The original build order put the engine and multiplayer before modifiers. In practice the prototype built modifiers early, then moved the engine into `game-core` and added the server. Both are now in place.

### Done

- Monorepo (pnpm), `game-core`, CI on every PR, Pages deploy
- Full FIDE engine with tests, modifier-aware blocked turns
- 25 modifiers with tests, draft rules in game-core
- Chick and Pigeon bots in a Web Worker
- Fastify + Socket.IO server: rooms, draft, saved games, accounts, friends, chat, feedback

### Next

1. Move bot and random-draft randomness to the seeded PRNG
2. Balance test harness: bot-vs-bot runs per modifier, logged win rates
3. Phaser board renderer (section 1.1)
4. Per-player visibility in game-core, then the fog cards
5. Replay log and viewer
6. Story Tower 1 run system

### Later

Postgres + Redis, matchmaking and ratings, Magnus bot, Battle Pass and store, puzzles, Tauri and Steam.
