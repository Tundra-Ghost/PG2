# Pigeon Chess: Game Design Document

**Version:** 0.2 · **Status:** Pre-production, playable prototype
**Related:** [Modifier Bible](modifier-bible.md) · [TDD](tdd.md) · [Art Direction](art-direction.md)

> "A cursed board. A disgraced champion. An infinite flock of consequences."

| Genre | Platform | Model | Team |
|---|---|---|---|
| Roguelike chess | Web first, then Steam. Phones supported. | F2P + Battle Pass | Solo / tiny |

## Change log

**v0.2 (2026-10-30)**
- Converted from HTML to Markdown.
- Added Core Rules (section 3.3) and a glossary link.
- Section 4 no longer lists modifiers. It links to the Modifier Bible, which is the only source of card rules.
- Added the current draft rules (section 4.3) and the Practice mode.
- Phones are now in scope. The game already supports them.
- Roadmap rewritten as Done / Next / Later.
- Rating system named consistently: Glicko-2, shown as "rating".
- Online hosting is on hold.

**v0.1** First draft.

## 1. Vision and pillars

Chess is the most elegant game ever devised. Pigeon Chess is what happens when you let pigeons play it.

Pigeon Chess is a web and Steam roguelike chess game. Every match is shaped by a chaotic modifier system. No two games are the same. Players bring skill. The pigeons bring entropy.

The game respects chess strategy while taking it apart, one absurd modifier at a time. It targets bored chess players, curious non-chess players, and anyone who ever wanted to watch a bishop walk off the board.

### Design pillars

**Pillar 1. Controlled Chaos.** Every modifier must be legible at a glance. Players should understand what is happening and laugh, not be confused. Chaos is the look. Clarity is the discipline.

**Pillar 2. Skill Always Matters.** Even in maximum chaos, the better chess player should win more often than not. Modifiers shift the odds. They do not remove choice.

**Pillar 3. The Flock Is Alive.** Pigeons are characters, not a skin. They have names and opinions. They land on squares when you do not want them to.

**Pillar 4. Community Is the Content.** Puzzles, cosmetics, modifier ideas and events come from players. Systems are built to allow this from day one.

### Target audience

| Segment | Profile | Hook |
|---|---|---|
| Chess casuals | Plays online, rating 800 to 1200, bored by strict rules | Same game, finally fun and weird |
| Roguelike fans | Slay the Spire, Hades, Monster Train | Deep progression and modifier synergies |
| Chaos enjoyers | Streamers, meme culture, party gamers | Shareable, unpredictable moments |
| Competitive players | Rating-driven, tournament-minded | Ranked mode with a real skill ceiling |
| Puzzle solvers | Wordle, NYT Games, chess puzzles | Community puzzle platform |

## 2. Story and narrative

**Premise.** You are **Viktor Crumb**, once the world's most feared chess grandmaster. Undefeated for eleven years. Then, at the World Championship, a flock of pigeons landed on the board mid-match and you made the wrong move. You lost. You were disgraced.

Years later, you find a strange board at a flea market. It pulses. It coos. When you place a piece on it, the pigeons come. And they change everything.

### Structure

Story Mode is a roguelike campaign. Viktor fights through five Grandmaster Towers to reclaim his title. Each Tower is one roguelike run: pick modifiers, battle opponents, unlock lore.

| Tower | Name | Theme | Boss | Scope |
|---|---|---|---|---|
| 1 | The Beginner's Gauntlet | Tutorial chaos. Light modifiers. | The Prodigy, an 8-year-old who plays perfectly but hates birds | Launch |
| 2 | The Clocktower | Time: timers, turns, temporal pieces | The Archivist, who plays every game as if it was already played | Launch |
| 3 | The Fungal Board | Mutating, spreading terrain | The Groundskeeper, who thinks the board is a garden | Launch |
| 4 | The Mirror Palace | Asymmetric armies, fog, information | The Diplomat. Every move is a negotiation. | Post-launch |
| 5 | The Pigeon Sanctum | Pure absurd chaos | The Flock, a pigeon collective that plays as one | Post-launch |

Tower 1 doubles as the tutorial. It needs its own plan (see Missing docs in section 12).

### Tone

Dialogue is dry, deadpan, and self-aware. Viktor takes chess desperately seriously. Everyone else treats the chaos as normal. The humor is in the gap.

> **Viktor:** "There is a pigeon sitting on my queen."
> **The Prodigy:** "I know. She's been there since last Tuesday. Her name is Margaret. She's rated 1,400."
> **Viktor:** "That is not possible."
> **The Prodigy:** "Margaret, it's your turn."
> *[The pigeon moves a rook.]*

## 3. Core game loop

### 3.1 Match loop

1. **Draft.** Players pick modifiers. The format depends on the mode (section 4.3).
2. **Setup.** The board is built from the active modifiers: tiles, fog, army changes.
3. **Match.** Chess with modifiers. Abilities are used from the ability bar. Events (Gerald, lava, storm) fire on timers or conditions.
4. **Result.** Win, loss or draw. Rating, XP and currency are awarded where the mode has them.
5. **Post-match.** Optional feedback survey. Later: replay and highlights. In runs, the next node opens.

### 3.2 Run loop (Story and Endless)

1. **Run start.** 1 free modifier pick, 0 curses. A starting deck drawn from the unlocked pool.
2. **Run map.** Branching nodes: matches, events, shops, rest sites. The player picks a route.
3. **Between matches.** Earn Feathers. Buy or sell modifiers, remove curses, find relics.
4. **Boss match.** Ends each Tower. The boss has fixed modifiers that cannot be banned.
5. **Run end.** Win or lose, unlock permanent rewards.

Session length target: 20 to 40 minutes. Longer loops: daily quests, weekly Battle Pass, seasonal ranked, long-term story.

### 3.3 Core rules

Full detail lives in the [Modifier Bible core rules](modifier-bible.md#core-rules-for-all-modifiers). Summary:

- **Words:** a *move* is one player's action. A *round* is one move by each side. All timers use these words.
- **Base rules:** standard chess (FIDE) plus modifiers. Draws by stalemate, threefold repetition, 50-move rule, and insufficient material.
- **King is sacred:** no modifier can capture or remove the real King.
- **Check uses normal movement,** even if a modifier stops the piece from moving.
- **No legal moves:** if modifiers block every move, the side in check is checkmated. Otherwise the turn is skipped. Two skips in a row is a draw.
- **Resign and draw offers** are always available.

## 4. Modifier system

Modifiers are the heart of Pigeon Chess. Each has a category, a tier, a point cost and a curse rating (0 to 3). Curse ratings feed Viktor's Madness Meter in runs.

### 4.1 Categories

| Code | Category | Example |
|---|---|---|
| A | Board Mutations | The Floor Is Lava: four tiles burn any piece that lands on them. |
| B | Cursed | Distracted Piece: Gerald sits on one of your pieces so it cannot move. |
| C | Active Abilities | FOR THE EMPEROR: your rook fires a cannonball down its line. |
| D | Fog of War | It's Dark And I'm Scared: you only see near your own pieces. |
| E | Asymmetric Armies | The Small Council: trade knights and bishops for 12 pawns. |

All 40 cards, their rules, costs and build status are in the **[Modifier Bible](modifier-bible.md)**. This document does not repeat card rules, so the two cannot disagree.

### 4.2 Scope

- **Shared** cards change the whole board for both players (Lava, Storm, Swamp). Only one player can draft each.
- **Owner** cards affect only the player who drafted them. A curse hurts its owner. An ability helps its owner. Both players can draft their own copy.

### 4.3 Draft rules

**Built today**

| Mode | Format | Budget | Limits |
|---|---|---|---|
| New Run vs bot | Alternating picks, player first. Can finish early. | 8 pts | Max 5 cards, max 2 per category |
| Practice | You pick for both sides. Picks can be removed. | Unlimited | None. Shared cards stay exclusive. |
| Online room (paused) | Modifier draft or standard chess, chosen at room creation | 8 pts | Same as New Run |
| Standard chess | No draft | n/a | n/a |

Curses have negative cost, so they add to the budget. Only built cards are offered.

**Planned**

| Mode | Format | Budget | Bans |
|---|---|---|---|
| Story / Roguelike | One-sided pick from the unlocked pool | 8 pts, grows with the Tower | None |
| Casual multiplayer | Auction: both players bid from a shared pool | 10 pts each | 1 per player |
| Ranked multiplayer | Alternating picks and bans | 12 pts shared | 2 per player |
| Puzzle | Set by the puzzle creator | Fixed | None |

### 4.4 Balance philosophy

Every modifier must pass the Laugh Test (is the chaos fun?) and the Rematch Test (does the loser want to play again?). Modifiers that leave one player helpless must be nerfed or redesigned. See the Bible for the balance test plan and the curse pricing method.

## 5. Roguelike meta-progression

*Not built yet.*

### Run structure

Each run is one Tower (Story) or an Endless Gauntlet. Runs use a branching node map.

| Node | What happens | Frequency |
|---|---|---|
| Match | A match with your current loadout | 60% |
| The Flock Event | A story event with 2 or 3 choices: gain a modifier, lose one, or take a cursed bargain | 15% |
| The Roost (Shop) | Spend Feathers on modifiers, relics, Viktor upgrades | 15% |
| The Perch (Rest) | Remove one curse OR preview the next opponent's loadout | 10% |
| Boss Match | End of Tower. Fixed cursed modifiers plus a boss mechanic. | 1 per Tower |

### Currencies and resources

- **Feathers (run currency).** Earned per match, spent at The Roost, lost at run end.
- **Relics.** Passive items for one run. Max 3. Examples: The Bent Pawn (pawns promote one rank early), Margaret's Feather (ignore one pigeon interference per match), The Crumpled Draw Offer (one free draw per run).
- **Prestige Tokens (meta currency).** Earned by finishing runs, win or lose. Spent on the progression tree.
- **Madness Meter.** Madness = total curse rating of active modifiers × 10, capped at 100. As it fills, Viktor's dialogue gets stranger, hidden modifiers unlock, and the board shows odd visuals. At 100, the secret "Full Flock" modifier triggers.

Note: the in-game "The Roost" menu currently shows local records and the profile. The shop use comes with runs.

### Redemption Tree

A permanent skill web bought with Prestige Tokens. Three branches:

- **Tactician:** deeper synergies, bigger draft budget, rule variant modifiers.
- **Survivor:** more rest nodes, better relics, cheaper curse removal, pigeon deterrents.
- **Flock Whisperer:** higher-curse modifiers, Feather bonuses for cursed play, pigeon companions, secret Flock Army modifiers.

## 6. Game modes

| Mode | Description | Modifiers | Timer | Status |
|---|---|---|---|---|
| New Run (vs bot) | One match with an alternating draft vs a bot | 8 pt draft | None | **Built** |
| VS Bots | Standard chess or draft. Bots: Chick (easy), Pigeon (medium), Magnus (hard, planned). | Draft or none | None | **Built** (Chick, Pigeon) |
| Practice | Sandbox. Unlimited free pick for both sides. | Unlimited | None | **Built** |
| Online room | Two players by room code. Saved games, chat, friends. | Draft or none | None | **Built, hosting paused** |
| Story Mode | Viktor's campaign through the Towers | One-sided pick | Optional | Launch |
| Endless Roguelike | Infinite gauntlet with a leaderboard | Scaling pick | Optional | Launch |
| Casual multiplayer | Matched play, no rating change | Auction | Optional | Launch |
| Ranked multiplayer | Rated ladder with seasons | Draft and bans | Required (Rapid or Blitz) | Launch |
| Puzzle Mode | Community puzzles, daily puzzle, creator tool | Creator-set | Optional | Launch |
| Tournaments | Scheduled events with custom rules | Organizer-set | Organizer-set | Post-launch |
| Spectator | Watch ranked and tournament games | n/a | Live | Post-launch |

### Timer options (planned)

- Bullet: 1 min + 0 s
- Blitz: 3 min + 2 s
- Rapid: 10 min + 5 s
- Classical: 30 min (Story and Casual only)
- Untimed: Casual and Puzzle. Saved online games are untimed today.

## 7. Chess rule variants

Variants change the base rules. At launch they are only in VS Bots and Casual, never in Ranked.

| Variant | Rule change | Source | Scope |
|---|---|---|---|
| Pigeon Chess Standard | FIDE rules + modifiers | Default | Launch |
| 960 Flock | Chess960 starting positions + draft | Meta-tree unlock | Launch |
| Extinction Chess | Win by capturing all of one piece type | Meta-tree unlock | Post-launch |
| Three-Check Pigeon | Win by checking the king 3 times | Meta-tree unlock | Post-launch |
| Atomic Chess | Captures explode nearby squares | Tower 3 unlock | Post-launch |
| Horde Mode | One side plays 36 pawns | Flock Whisperer branch | v2.0 |

## 8. Ranking and competitive

*Not built yet. Profiles show a placeholder rating.*

### Rating: The Pecking Order

Pigeon Chess uses **Glicko-2** (as Lichess does). In the game it is just called "rating". A small Chaos Coefficient lowers rating swings in high-modifier matches. New players start at 1200.

| Tier | Name | Rating | Reward |
|---|---|---|---|
| 🥚 | Egg | 0 to 499 | Season participation cosmetic |
| 🐣 | Hatchling | 500 to 799 | Animated board border |
| 🐦 | Fledgling | 800 to 1099 | Modifier card skin |
| 🕊️ | City Pigeon | 1100 to 1399 | Piece cosmetic set |
| 🦅 | Roof Hawk | 1400 to 1699 | Animated board theme |
| 🦉 | The Owlmaster | 1700 to 1999 | Title + pigeon companion |
| 👑 | The Flock King | 2000+ | Season trophy, profile crown, legacy cosmetic |

### Seasons

- Each season lasts 3 months with a themed modifier pool (for example, Season 1: Winter Flock).
- At season end, ratings soft-reset 30% toward the median.
- Top 100 players on a live leaderboard.
- 10 placement games before a rating shows.

## 9. Community and puzzles

*Not built yet.*

### Puzzles

A puzzle is a position plus a modifier loadout and a goal. "Win in 3 with The Cordyceptic Spread active." "Survive 5 rounds against Hatoful Gambit."

**Built so far (local only):** the Puzzles screen has three starter puzzles, an editor (click to place pieces, solver side, goal, difficulty, any playable modifier with an owner), a Test button, and play mode where the Pigeon bot defends. Puzzles save in the browser and share as `PC1-` codes. Code: `packages/game-core/src/puzzle`, `game/src/components/Puzzle*`. Voting, discovery and server storage are not built.

**Creator tool:** drag-and-drop board editor, any modifier combo, goal (checkmate, capture, survive N rounds), difficulty tag (Egg, Hatchling, Grandmaster), submit for community voting.

**Discovery:** daily featured puzzle, Hot / New / Top tabs, filters by modifier, difficulty and piece count, puzzle streaks, creator follows.

### Community cosmetics

Players can submit board themes, piece skins and card art to a Community Workshop. Approved designs go on sale with revenue sharing (suggested 30% to the creator).

Categories: board themes, piece sets, modifier card art, pigeon companions, Viktor outfits, capture effects. Art rules are in the Art Direction guide.

### Feedback (built)

An in-game feedback form (Settings > Feedback) and an optional post-game survey collect player input.

## 10. Monetization

**Iron rule.** No modifier, relic or gameplay advantage can ever be bought with real money. Modifiers unlock through play only. Everything for sale is cosmetic.

| Stream | Description | Price | Cadence |
|---|---|---|---|
| Battle Pass | 50-tier cosmetic track, free and premium | $9.99 / season | Quarterly |
| Cosmetics store | Board themes, piece sets, companions. No loot boxes. | $2.99 to $14.99 | Weekly rotation |
| Community store | Player-made cosmetics, revenue split | $1.99 to $9.99 | Ongoing |
| Pigeon Pass | Yearly: premium pass every season + monthly companion | $29.99 / year | Annual |

**Never sold:** modifiers, rating boosts, loot boxes or gacha, story skips, exclusive game modes.

**Battle Pass:** 50 tiers. Free track: XP boosts, Feather bonuses, 1 board theme, 1 card skin. Premium adds a piece set, 2 companions, a Viktor outfit, animated board effects, a title and a season trophy.

## 11. Technical architecture (summary)

The [TDD](tdd.md) is the source of truth. Summary:

- **Web first.** Steam later through a Tauri wrapper. Phones are supported in the browser.
- **One rules package** (`packages/game-core`): custom TypeScript chess engine plus all modifiers.
- **Offline modes** (bots, practice, New Run) run game-core in the browser. **Online games** are checked by the server.
- **Board renderer:** React today. Phaser 3 is still the plan for the board and effects.
- **Every match should be replayable** from a seeded event log.

## 12. Roadmap and scope

**Reality check.** This is an ambitious game for a tiny team. Each phase must be a playable product.

### Done (as of 2026-10-30)

- Custom chess engine with full FIDE rules and tests
- 28 of 40 modifiers playable, with draft, ability bar, event banners and board effects
- New Run, VS Bots (Chick, Pigeon), Practice, Standard chess
- Shared rules package, game server, online rooms, saved games, accounts, friends, chat (hosting paused)
- Local profiles, records, achievements
- Mobile layout
- Engraved SVG pieces and a modifier icon set
- Sounds for moves, captures, castling, UI clicks and menu/game music (modifier event sounds are made but not in the game yet)

### Next

- Remaining modifiers that need new systems: per-player fog, Hatoful Gambit, Bandersnatch, the inverted-move curse
- Balance test run (bot vs bot) for all built cards
- Phaser board renderer, with sprite-sheet-ready pieces
- Story Tower 1 (doubles as the tutorial)
- Replays from a seeded event log
- Magnus bot

### Later

- Resume online hosting when it makes sense
- Ranked, rating, seasons
- Battle Pass and cosmetics store
- Puzzles and the creator tool
- Towers 2 to 5, Endless mode, the meta-progression tree
- Steam (Tauri), tournaments, spectator mode, rule variants

### Missing docs

- Modifier interaction table (which pairs are banned or tested)
- Tower 1 tutorial and story script
- Reginald Beak's review lines (about 30 of 150)
- Asset production list

### Risk register

| System | Risk | Mitigation |
|---|---|---|
| Modifier balance | High: stacking grows complexity fast | Small pool, draft caps, bot-vs-bot balance runs, 2-week patch cadence |
| Real-time multiplayer | High: latency, desync, cheating | Server-checked moves for online play |
| Full roguelike (5 Towers) | High: content volume | Phase release. Towers 1 to 3 at launch. |
| Hosting cost | Medium: paid hosting needed for online play | Online paused until it is worth paying for |
| Community puzzle abuse | Medium | Review and flagging before approval |
| Rating integrity with modifiers | Medium | Chaos Coefficient, curated ranked pool |
| Art volume | Medium | Community Workshop, swappable piece layer |
