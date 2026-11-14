# Pigeon Chess: Modifier Design Bible

**Ref:** PC-MOD-001 · **Version:** 0.4 · **Status:** Draft, pre-production
**Related:** [GDD](gdd.md) · [TDD](tdd.md) · [Art Direction](art-direction.md) · [Hook model](modifier-hook-model.md)

100 modifiers in 5 categories, 20 each: 45 built, 55 designed. Max curse 3. Max cost 5 pts.

| Code | Category | What it does |
|---|---|---|
| A | Board Mutations | Tiles that change, move, or destroy |
| B | Cursed | Negative effects that grant points |
| C | Active Abilities | Cooldown powers on piece types |
| D | Fog of War | Information and visibility variants |
| E | Asymmetric Armies | Non-standard piece configurations |

## Change log

**v0.4 (2026-11-14)**
- 60 new design cards, 12 per category (A009 to E020), for 100 in all. None are built yet. They show in the Collection and under "Show upcoming" in the draft, and the draft never offers them.
- Each new card was checked against the design rules: legible at a glance (Rule 03), skill still decides (Pillar 2), the King is never removed or hidden (Rule 04), no softlocks (Rule 06), curses priced by moves lost (Rule 08). The rulings under each card record how.
- Three new support cards (Footprints, Flashlight, Crystal Ball) and Tells are gated in the draft like Cat Mode, so they are never dead picks.
- New conflicts to enforce when built: The Magic Roundabout with This Is My Swamp, and Night Shift with It's Dark And I'm Scared (one of each pair per match).

**v0.3 (2026-10-30)**
- Converted from HTML to Markdown.
- Built cards now describe the rules the game actually plays. The build is the source of truth. Each changed card has a "Changed from v0.2" note.
- Added the glossary below. Every timer now says *moves* or *rounds*.
- Added a **Scope** line to every card (Shared or Owner).
- Added the Core Rules section (no legal moves, check with modifiers).
- 7/10 Too Many Pieces now costs 0 and has curse 0. It had no gameplay effect, so it was free points.
- Cat Mode is only offered once a fog card is in the draft.
- Added the curse pricing method and the balance test plan.

**v0.2** Pop-culture retheme. Names and flavor rewritten. Mechanics unchanged from v0.1.

## Glossary

These words mean the same thing in every Pigeon Chess doc and in the code.

| Word | Meaning |
|---|---|
| **Move** | One action by one player: a piece move, an ability, a sacrifice, or shooing Gerald. Chess calls this a ply. |
| **Round** | One move by White and one move by Black. |
| **Your move** | A move made by the card's owner. "Every 3 of your moves" ignores the opponent's moves. |
| **Owner** | The player who drafted the card. |
| **Scope: Shared** | The card affects the whole board and both players. Only one player can draft it. |
| **Scope: Owner** | The card affects only its owner. A curse hurts the owner. An ability helps the owner. Both players may draft their own copy. |
| **Built** | Playable in the current build. |
| **Design** | Not built yet. Rules may change when built. |

Older text that says "turn" should be read as "round" unless it says "your turn".

## Core rules for all modifiers

These rules apply to every card. A card can never break them.

1. **The King is sacred.** No modifier may capture, remove, freeze in place forever, or hide the real King. Kings are immune or spared wherever a card would remove pieces.
2. **No self-check.** A move that leaves your own King in check is always illegal. Modifier moves (autonomous moves, slides, chains) skip any option that would do this.
3. **Check uses normal movement.** A piece gives check by its normal chess movement, even when a modifier stops it from moving. A knight stuck in the Swamp or a piece held by Gerald still gives check.
4. **No legal moves.** If modifiers block every move for the side to play:
   - In check: that side is checkmated.
   - Not in check: the turn is skipped and the event shows in the feed.
   - If both sides are skipped back to back, the game is a draw (stalemate).
5. **Shooing Gerald in check is not allowed.** It would pass the turn while in check.
6. **Seeded randomness.** Every random choice by a modifier uses the game's seeded random number generator, so replays stay exact.

## Category A: Board Mutations

The board physically changes mid-match. Tiles spread, burn, sink, freeze, or flip.

### MOD-A001 · The Cordyceptic Spread
*Ref: The Last of Us / Cordyceps* · **Tier S** · Cost 4 · Curse 1 · Scope: Shared · Modes: All · **Built**

Every 5 rounds, one random empty tile becomes Infected. A piece standing on an Infected tile loses 1 square of movement for each round it stays still (minimum 1). A Bishop or Queen clears every Infected square it crosses or lands on. Each round, an Infected tile has a 25% chance to infect one adjacent tile.

*The mushroom is patient. The mushroom always wins eventually.*

- Synergy: It's Dark And I'm Scared. Hidden infected tiles are catastrophic.
- Conflict: The Floor Is Lava. Infection cannot spread onto Lava.
- Ruling: rooks, bishops, queens and chancellors lose reach. Pawns lose their double step. Knights and kings are not slowed. Moving the piece resets its count. The slowed piece shows its reach on its square.
- Ruling: lava burns infection away.

### MOD-A002 · The Floor Is Lava
*Ref: "The floor is lava" meme* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Built**

Four tiles are Lava. A piece that lands on Lava is lost, either colour. Kings are immune. Lava moves every 3 moves (counting both players). The next 4 spots are shown with a dashed amber outline. If a piece stands on a shown spot when lava moves, that spot is swapped for a random empty square. When a piece burns, its square flashes.

*Everyone knows the floor is lava. Nobody is handling it well.*

- Synergy: Vent Tiles. A piece ejected onto Lava burns.
- Conflict: The Cordyceptic Spread. Lava cannot become Infected.
- Changed from v0.2: moves every 3 moves, not every 10 rounds. No amber preview yet. Kings are immune.

### MOD-A003 · Vent Tiles
*Ref: Among Us / Fall Guys traps* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Built**

Three hidden Vents spawn on ranks 3 to 6. The first non-king piece to land on a Vent jumps to the opposite square and captures whatever is there, either colour. The Vent then becomes a shaft no piece can enter or cross. A Vent jams (and stays hidden) if the exit holds a King or the jump would expose your King.

*Nobody saw what happened. Nobody is talking about it.*

- Synergy: I'm Literally Right Here. Decoys can trigger Vents.
- Synergy: It's Dark And I'm Scared. Nobody can track Vents in fog.
- Changed from v0.2: Vents only spawn on ranks 3 to 6. Kings never trigger them. Jam rule added.

### MOD-A004 · Winter Is Coming (To Your Pieces)
*Ref: Game of Thrones* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Built**

Ranks 1 to 3 and 6 to 8 are Frozen. A piece that enters a Frozen zone from ranks 4 or 5 must wait one of its owner's moves before moving again. Castling is blocked. The zone shows as a light tint and frozen pieces show a snowflake.

*The cold is very real.*

- Synergy: Heavy Is The Crown. A slow King in the cold is nearly stuck.
- Conflict: The Small Council. 12 pawns on home rows risk gridlock.
- Changed from v0.2: only pieces entering from the middle ranks freeze. Pieces that start in the zone are free. "Pawns freeze before promoting" is dropped.

### MOD-A005 · The Storm Closes In
*Ref: Fortnite storm / Minecraft world border* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Built**

Every 8 rounds the storm takes part of the outer ring: corners first, edge middles last. The board is a full 6×6 after round 32. Squares about to go are striped one wave ahead. Pieces caught by the storm are lost. Kings are spared until they step off. Nothing can enter or cross storm squares.

Promotion: once the square ahead of a pawn is storm, that pawn promotes on the last open rank.

*Get to the circle. Stay in the circle.*

- Synergy: The Floor Is Lava. The shrinking board pushes pieces toward Lava.
- Synergy: Gravitational Anomaly. Gravity can push pieces into the storm.
- Conflict: The Small Council. Very crowded endgame. Softlock test required.
- Changed from v0.2: corners first, 6×6 by round 32 (not 40), kings spared, last-open-rank promotion.

### MOD-A006 · This Is My Swamp
*Ref: Shrek* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Built**

The four centre squares (d4, d5, e4, e5) are the Swamp. A piece that starts its move in the Swamp moves only 1 square, captures included. Pieces may still slide through. A knight that lands in the Swamp is stuck for 2 of its owner's moves, then leaps out normally. Swamp pieces still give check at full range (Core rule 3).

*The Swamp is contested. The Swamp is disgusting. The Swamp is strategically essential.*

- Synergy: I Hereby Declare. A decree through the Swamp makes a wall.
- Conflict: Did I Do That? The rook move cannot start in the Swamp.
- Changed from v0.2: pieces can pass through; the limit only applies when starting in the Swamp.

### MOD-A007 · Gravitational Anomaly (Don't Think About It)
*Ref: Interstellar / Gravity Falls* · **Tier S** · Cost 5 · Curse 2 · Scope: Shared · Modes: All except Ranked S1 · **Built**

Every 12 rounds gravity pulls sideways, east then west, back and forth. Every piece slides one square that way if the square is free, with a warning the move before. Pieces pushed off the edge are lost. Kings brace and stay. Pawns keep their direction. A pawn pushed onto its last rank becomes a queen. Castling is gone after the first shift.

*Nobody ordered this. It happened anyway.*

- Synergy: The Storm Closes In. Gravity can push pieces into the storm.
- Conflict: Winter Is Coming. Frozen pieces do not slide (when both are built together, test this).
- Changed from v0.2: sideways only. No flip to a new "bottom". Pawns do not re-orient. Kings do not slide.

### MOD-A008 · Bandersnatch Protocol
*Ref: Black Mirror* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: Casual, Story · **Built**

The board is split by an invisible axis. A move on one half is mirrored on the other half. Pieces colliding on the axis swap places. Kings are exempt. Both players are affected equally.

*Every choice echoes.*

- Synergy: I'm Literally Right Here. Mirrored decoys add confusion.
- Balance flag: needs edge case tests with castling.
- Open question: which piece mirrors? The design text says "for that piece", which is unclear. Define before building.
- Built: the mirror twin moves. When a piece moves, the own piece on the mirror of its start square (across the d/e line, same rank) makes the mirrored move if it is legal for it, and it can capture. Kings, castling and abilities never mirror, and a mirrored pawn that reaches the last rank becomes a Queen. Two pieces can never land on the same square, so the swap rule is not needed. A cyan line marks the axis.

### MOD-A009 · The Birds (Hitchcock Mode)
*Ref: The Birds (1963)* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Design**

Every 6 rounds a flock lands on a random empty 2×2 area of ranks 3 to 6. Nothing can land on or cross those squares for 2 rounds. The landing spot is shown one round ahead.

*The pigeons have chosen a spot. It is the spot Viktor needed. This is not a coincidence.*

- Ruling: the flock only lands on empty squares, so it never removes a piece.
- Synergy: The Storm Closes In. Fewer open lanes on a shrinking board.
- Safety: a flock never lands on a square that would leave a King with no legal move.

### MOD-A010 · The Factory Must Grow
*Ref: Factorio* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Design**

Ranks 4 and 5 are conveyor belts. At the end of each round, every piece on rank 4 slides one square right and every piece on rank 5 slides one square left. A piece stops at the board edge or behind another piece. Arrows show the belt direction.

*Viktor placed his knight on the belt. The knight is now somewhere else. The factory is pleased.*

- Ruling: belts never capture. A blocked piece stays put.
- Ruling: a King rides the belt only if the new square is safe. Otherwise it stays.
- Conflict: This Is My Swamp. Pieces may ride into the Swamp. Intended.

### MOD-A011 · Thinking With Portals
*Ref: Portal* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Design**

A blue portal sits on c4 and an orange portal on f5. A non-King piece that ends its move on one portal steps out of the other, if that square is empty. Portals never capture and stay all match.

*Viktor's rook entered on the left. It left on the right. Viktor is still on the left.*

- Ruling: if the exit is occupied, the piece simply stays on the entry portal.
- Ruling: the jump may not leave its own King in check; if it would, it does not happen.
- Not Vent Tiles: portals are visible, permanent and never capture.

### MOD-A012 · Let It Go
*Ref: Frozen* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Design**

The central 4×4 squares are ice. A rook, bishop or queen that moves onto ice keeps sliding the same way until it reaches the edge of the ice or the square before a piece. It may still capture the piece it was moving to.

*The queen stepped onto the ice. The queen is now on the other side of the ice. The queen did not plan this.*

- Ruling: knights, pawns and kings are not affected. They have good shoes.
- Ruling: a slide that would leave its own King in check stops on the first legal square.
- Not Winter Is Coming: winter stops pieces, ice keeps them going.

### MOD-A013 · The Magic Roundabout
*Ref: Swindon's Magic Roundabout* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Design**

The four centre squares are a roundabout. At the end of each round, pieces on d4, e4, e5 and d5 move one step clockwise around it, if the next square is free.

*Viktor entered the roundabout in round 6. He is still deciding where to exit.*

- Conflict: This Is My Swamp. Both use the centre; only one may be in a match.
- Ruling: a King rotates only if the new square is safe.
- Ruling: rotation never captures. A blocked piece waits.

### MOD-A014 · Minesweeper
*Ref: Minesweeper* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Design**

Four hidden mines sit on ranks 3 to 6, two on each half of the board. When a piece stops next to a mine, its square shows how many mines touch it, like the classic game. The first non-King piece to land on a mine is lost and the mine is used up.

*Viktor has studied the numbers. Viktor believes the mine is on f5. Viktor sends a pawn to check.*

- Ruling: Kings never trigger mines and mines are never placed next to a starting King.
- Skill: the numbers turn a random loss into a deduction puzzle.
- Not Vent Tiles: vents relocate pieces, mines remove them, and mines give clues.

### MOD-A015 · The Roomba
*Ref: Robot vacuum videos* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Design**

A robot vacuum travels clockwise around the outer ring of the board, one square per round. When it reaches a piece, it pushes that piece one square inward if that square is empty. Otherwise it waits.

*It has bumped into Viktor's rook four times. It will bump into it again. It has no other plans.*

- Ruling: the Roomba never captures and never pushes a King into check.
- Synergy: The Storm Closes In. Once the storm takes the edge, the Roomba parks itself.

### MOD-A016 · Monument To Gerald
*Ref: Pigeons and statues, forever* · **Tier B** · Cost 1 · Curse 0 · Scope: Shared · Modes: All · **Design**

A statue of Gerald stands on e4. Nothing can land on it or pass through it. A piece moving into it from an adjacent square pushes it one square the same way, if that square is empty. The push is the whole move.

*They built him a statue. Gerald has been sitting on it since the ribbon was cut.*

- Ruling: the statue cannot be captured. Like any piece, it blocks lines, including lines of check.
- Synergy: Distracted Piece. Gerald is now in two places. Nobody can explain this.

### MOD-A017 · Tide Goes In, Tide Goes Out
*Ref: "You can't explain that" meme* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Design**

Every 8 rounds the tide comes in and ranks 4 and 5 become water for 4 rounds. Pieces may cross water but only knights may stop on it. A piece already on water when the tide arrives may only move off it. A warning shows the round before.

*The tide came in. The tide went out. Viktor cannot explain that.*

- Ruling: a King caught by the tide may still move normally. The King is sacred.
- Conflict: The Factory Must Grow. Belts stop while flooded.

### MOD-A018 · Shake It Off
*Ref: Taylor Swift* · **Tier S** · Cost 4 · Curse 2 · Scope: Shared · Modes: All · **Design**

Every 10 rounds an earthquake moves every non-King piece one square in a random direction, if that square is empty. Each piece shows its arrow one round ahead, so both players can prepare.

*The ground is shaking. Viktor's pieces are shaking. The pigeons are dancing.*

- Ruling: no piece is ever shaken off the board, onto another piece, or into a square that leaves its King in check.
- Skill: the one-round warning is the point. A prepared player gains from the quake.

### MOD-A019 · Crop Circles
*Ref: Signs / The X-Files* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Design**

Every 8 rounds a 3×3 crop circle appears on the middle ranks for 3 rounds. Pieces inside it cannot be captured. They can still move and capture out of it.

*Something made these patterns overnight. Viktor's bishop is inside one. It feels safe. It has not asked why.*

- Ruling: a King in the circle is still in check normally. Safe zones never break check.
- Synergy: FOR THE EMPEROR. The cannonball passes over circle pieces.

### MOD-A020 · One Way Street
*Ref: Every city centre* · **Tier B** · Cost 2 · Curse 1 · Scope: Shared · Modes: All · **Design**

The c-file runs north only and the f-file runs south only. A piece moving along one of those files may only move in its arrow's direction. Crossing the file sideways is allowed.

*Viktor's rook wished to go home. The sign said no.*

- Ruling: Kings ignore the signs. They have a motorcade.
- Ruling: arrows only limit movement along the file, never captures that happen to cross it.

## Category B: Cursed

Negative effects that grant extra point budget. Curses fill the Madness Meter. All curses are Scope: Owner.

### Curse pricing

A curse should give back about as much as it takes away (Rule 08). Price each curse by how many moves it costs its owner in a normal 40-round game:

| Moves lost per game | Points granted |
|---|---|
| 0 (cosmetic only) | 0 |
| 1 to 3 | -1 |
| 4 to 8 | -2 |
| 9 or more, or a lost piece | -3 |

Under this method, Distracted Piece is likely under-priced at -2 (Gerald can cost many moves). Keep current prices until the balance test run (see Balance below) gives data.

### MOD-B001 · YOU DIED (But A Piece Did)
*Ref: Elden Ring / Dark Souls* · **Tier S** · Cost -3 · Curse 3 · Scope: Owner · Modes: No Ranked · **Built**

Every 7th move of the owner is played for them: a random legal move, never one that leaves the King in check. It counts as their move. Abilities are never used.

*The piece appears confident. It is not.*

- Conflict: Active Abilities. Autonomous moves never use abilities.
- Future: +2 Feathers per match in runs. A "A PIECE MOVED" banner.
- Changed from v0.2: counts the owner's moves, not rounds.

### MOD-B002 · Distracted Piece
*Ref: "Distracted Boyfriend" meme* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Built**

At the start of the owner's move, if no piece is held, Gerald the pigeon lands on a random non-king piece. That piece cannot move for 2 of the owner's moves. Click Gerald to shoo him off. That costs your move and is not allowed in check.

*Gerald always returns.*

- Synergy: Forgive Me, For I Have Moved. Reveals Gerald's next target early.
- Conflict: Gerald will not sit on Pigeon pieces (professional courtesy).
- Not built yet: Gerald's personal leaderboard.
- Balance: likely under-priced. See Curse pricing.

### MOD-B003 · No, I Don't Think I Will
*Ref: "No, I don't think I will" meme* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Built**

For the owner's first 5 moves, every piece moves in the opposite direction to the click. Forward becomes backward, left becomes right. Moves still have to be legal.

- Synergy: Winter Is Coming. Inverted moves near frozen zones are risky.
- Open question: what is the "opposite" of a knight jump or a castle? Define before building.
- Built: clicks are flipped across the centre of the board (e4 ↔ d5), not through the piece. Flipping through the piece would send every opening move off the board, so the owner could not move at all. This works the same for knights and castling. Picking up a piece is not flipped, and the highlights show where to click. An event says when the 5 moves are over. Bots are not affected.

### MOD-B004 · Heavy Is The Crown (uneasy lies)
*Ref: "Heavy is the head"* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Built**

The owner's King moves at half speed. Moving the King takes two moves: choose on the first, confirm on the second. During the wait the King glows and the opponent can see the destination. Castling takes 3 moves.

- Conflict: Winter Is Coming. A frozen slow King is near softlock.
- Built: select the King and press Order move to pick a square. That costs the turn. Make the move on any later turn. The ordered square shows a dashed gold frame.
- Ruling: in check, the King moves freely and the order is dropped.
- Changed: castling takes two turns like any King move, not three.

### MOD-B005 · 50 First Moves
*Ref: 50 First Dates / Memento* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: No Ranked · **Built**

From move 6, and every 6 moves after, the owner's move history is hidden for 3 moves, including the last-move highlight. En passant cannot be taken during a blackout.

*Every game is the first game.*

- Conflict: I've Been Waiting For This. A banked en passant is lost in a blackout.
- Changed from v0.2: hides only the owner's view.

### MOD-B006 · They Were The Traitor (1 Impostor Remains)
*Ref: Among Us ejection screen* · **Tier S** · Cost -3 · Curse 3 · Scope: Owner · Modes: No Ranked · **Built**

From move 11 on, each of the owner's moves has a 1 in 4 chance to pick a traitor: their most valuable non-king piece. It is marked with "!" and defects at the start of the owner's next move. If the marked piece is traded off first, the search starts again. Happens once per match.

*It does not say sorry.*

- Moneyball ruling: a defected piece that is later captured can be bought back.
- Changed from v0.2: the 1 in 4 roll replaces "a random turn after turn 10".

### MOD-B007 · Conscientious Objector
*Ref: pacifist protest memes* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Built**

One random pawn will not capture. It moves, blocks and promotes normally. If it promotes, the new piece is also a pacifist.

*This is not a glitch. This is its truth.*

- Conflict: Retaliatory Swipe. The Objector cannot use it.

### MOD-B008 · 7/10, Too Many Pieces
*Ref: IGN "too much water" review* · **Tier B** · Cost 0 · Curse 0 · Scope: Owner · Modes: All · **Built**

After each of the owner's moves, the pigeon critic Reginald Beak reviews it in the match feed. No gameplay effect. The card is free but uses a draft slot.

*"1/10. My grandmother could have done this and she is a pigeon."*

- Content: about 30 review lines written. Target 150.
- Changed from v0.2: cost 0 and curse 0 (was -1 / 1). A curse with no downside was free points. If Reginald ever gets a small gameplay effect, re-price it.

### MOD-B009 · Speedrun Any%
*Ref: Speedrunning* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Design**

You have 15 seconds for each move. If the timer runs out, a random legal move is played for you. The timer pauses while any popup is open.

*Viktor has never been rushed. Viktor is being rushed. Viktor finds it invigorating and upsetting.*

- Modes: not in correspondence-style online games.
- Ruling: the random move never leaves your King in check.
- Pricing: a fast player loses almost nothing, a slow one a lot. Skill matters.

### MOD-B010 · Main Character Syndrome
*Ref: Social media* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Design**

Your Queen must move at least once every 4 of your moves. If you skip her too long, your next move must be a Queen move if she has one.

*The queen would like to remind everyone that this is her story.*

- Ruling: in check, you may make any legal move. The demand waits.
- Ruling: once your Queen is captured, the curse ends.

### MOD-B011 · Case Of The Mondays
*Ref: Office Space / Garfield* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Design**

For your first 6 moves, none of your pieces may move more than 2 squares.

*It is round one. Viktor's bishop has not had its coffee.*

- Ruling: knights are unaffected; a knight jump counts as 2 squares.
- Ruling: castling is allowed. The King moves 2 squares, which is fine.

### MOD-B012 · Bless You
*Ref: Sneezing, universally* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Design**

Every 8th move you make with a rook, bishop or queen, the piece sneezes and stops one square short. A counter on the piece shows when the next sneeze is due.

*The bishop sneezed. The bishop is very sorry. The bishop is one square short of where it meant to be.*

- Ruling: if stopping short is illegal (it leaves your King in check), the move happens in full.
- Ruling: a one-square slide cannot sneeze. It does not have room.

### MOD-B013 · Death And Taxes
*Ref: Benjamin Franklin* · **Tier S** · Cost -3 · Curse 3 · Scope: Owner · Modes: All · **Design**

Every 10 of your moves, the tax office collects one of your pawns: the one furthest back. You are warned one move before. Once you have no pawns, the curse ends.

*Viktor has filed his return. The pawn has been seized. Viktor is told this is normal.*

- Pricing: costs about 4 pawns in a 40-round game, so it grants the full 3 points.
- Ruling: the tax never takes a pawn that is shielding your King from check; it takes the next one.

### MOD-B014 · Imposter Syndrome
*Ref: Every new job* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Design**

After your Queen captures, she doubts herself. Her next move can only be one square, like a King.

*She took the rook. She is not sure she deserved to take the rook. She will take one small step now.*

- Ruling: the doubt shows as a small cloud over the Queen.
- Synergy: Main Character Syndrome. She must move, but only a little. Character development.

### MOD-B015 · Commitment Issues
*Ref: The touch-move rule* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Built**

Touch-move rules apply to you. Once you select a piece that has a legal move, you must move that piece.

*Viktor touched the knight. The knight looked at him. They both knew what had to happen.*

- Built: the touch is part of the game state, so the server enforces it online. The touched piece wears a T and stays selected. Tapping another piece says why it cannot move.
- Built: the touched piece may move or use its ability. Shooing Gerald is not allowed after a touch.
- Ruling: selecting a piece with no legal moves does not count.
- Ruling: never a softlock. Only a piece with a legal move can be touched, so you always have a move.
- Phones: hold-to-read never counts as touching. Only a tap selects. This holds on every square, even one with nothing to read.
- Bots do not touch. A bot that owns the card picks one piece and moves it, which already keeps the rule.

### MOD-B016 · Lunch Break
*Ref: Union rules* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Design**

Every 10 of your moves, your rooks and Queen go on lunch. On your next move they cannot move. A sign shows the round before.

*The rooks have gone to lunch. They took the queen. They did not invite Viktor.*

- Ruling: in check, lunch is cancelled. Everyone works.
- Not Quiet Quitting: this is a curse on a schedule, not a choice.

### MOD-B017 · MINE!
*Ref: Finding Nemo* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Design**

Every 8 of your moves, a seagull swoops in and carries your most advanced pawn one square back toward your side, if that square is empty.

*The seagull took the pawn. The seagull said mine. Viktor disagrees about whose it was.*

- Ruling: the seagull never lands a pawn on rank 1 or 8 and never exposes your King.
- Lore: the seagull is not a pigeon. The pigeons are embarrassed for it.

### MOD-B018 · Rubber Banding
*Ref: Online game lag* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Design**

Every 7th move you make lags: the piece moves, then snaps back to where it started. The move still counts as your turn. A ping counter shows when the next lag is due.

*Viktor moved the bishop. The bishop moved back. Viktor blames his internet. Viktor does not have internet.*

- Ruling: captures never lag, and a move out of check never lags.
- Skill: the counter is visible, so you can spend the lag on a move you did not need.

### MOD-B019 · Peer Pressure
*Ref: Checkers* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Built**

If one of your pawns can capture, you must make a pawn capture. Your opponent can use this to drag your pawns out of position.

*All the other pawns were capturing. This pawn did not want to. This pawn captured.*

- Built: only a fully legal pawn capture counts, after every other card has had its say. En passant counts. If several pawns can capture, you pick one.
- Built: while a pawn capture is forced, abilities, Moneyball drops and shooing Gerald are not allowed either. Selecting another piece shows why it cannot move.
- Ruling: in check, any legal move is allowed.
- Ruling: never a softlock. The card only binds you when a legal pawn capture exists, so you always have a move.
- Ruling: pawn abilities do not count as the capture. Retaliatory Swipe and I've Been Waiting For This are blocked while a normal pawn capture is forced.
- Ruling: under fog, only captures onto squares you can see force you, so the card never gives away a hidden piece.
- Synergy: Conscientious Objector. The pacifist pawn is exempt and very smug about it.

### MOD-B020 · Roll For Initiative
*Ref: Dungeons & Dragons* · **Tier A** · Cost -2 · Curse 2 · Scope: Owner · Modes: All · **Design**

On every 3rd move you make, a die picks a piece type. You must move a piece of that type if you can. If you cannot, you choose freely.

*The die says knight. Viktor wanted the queen. The die does not care what Viktor wanted.*

- Ruling: in check, any legal move is allowed.
- Ruling: the die only rolls types you still have, so it is never a dead roll.

## Category C: Active Abilities

Cooldown powers on piece types. Select a piece, press the ability button. Using an ability costs your move. Cooldowns count the owner's moves and are tracked per piece. All abilities are Scope: Owner.

### MOD-C001 · I Hereby Declare (Executive Move)
*Ref: "I hereby declare" meme* · **Tier S** · Cost 4 · Curse 0 · King · Cooldown 8 · Modes: All · **Built**

Select the King and press the ability button, then click a square on the King's rank or file. That line closes: for 3 of the opponent's moves, enemy pieces cannot land on it or move across it. Pieces can still attack across it. The line shows in gold.

*The decree is binding. The pigeons have not been briefed.*

- Synergy: This Is My Swamp. Decree a line through the Swamp.
- Conflict: Heavy Is The Crown. A slow King delays the decree.
- Changed from v0.2: the line must pass through the King's square. Attacks still cross it.

### MOD-C002 · Forgive Me, For I Have Moved
*Ref: Confession Bear* · **Tier A** · Cost 3 · Curse 0 · Bishop · Cooldown 5 · Modes: All · **Built**

Target one enemy piece. For 2 of the opponent's moves, that piece must show its destination one move early. A ghost outline shows where it will go.

- Synergy: fog cards. The confession reveals the target through fog and shows if it is a decoy or Sus.
- Built: the target is an enemy piece (not the King) on one of the bishop's diagonals. The bishop does not move. For the target side's next 2 turns, the target's first move only declares the square: the turn is spent, an event names the square, and a dashed violet ring marks it. It can then only move to that square. In check it moves freely. Both squares are revealed through fog.

### MOD-C003 · Did I Do That? (Oops)
*Ref: Urkel* · **Tier A** · Cost 3 · Curse 0 · Knight · Cooldown 6 · Modes: All · **Built**

The knight moves like a rook this move and can capture. It cannot start from the Swamp.

*The Knight has no regrets.*

- Synergy: The Storm Closes In. Escape the edge in one move.

### MOD-C004 · Retaliatory Swipe (Look What You Made Me Do)
*Ref: Taylor Swift, Reputation* · **Tier B** · Cost 2 · Curse 0 · Pawn · Cooldown 4 · Modes: All · **Built**

The pawn captures one square diagonally backwards. No promotion from this capture.

- Conflict: Conscientious Objector cannot use it.
- Synergy: The Small Council. 12 pawns with backward capture.

### MOD-C005 · Quiet Quitting (Zone Of Control)
*Ref: Quiet quitting trend* · **Tier S** · Cost 5 · Curse 0 · Queen · Cooldown 10 · Modes: All · **Built**

Press the ability button, then click the Queen. She stays put. For 2 of the opponent's moves, enemy pieces cannot move into the 3×3 around her and cannot capture her. The zone ends early if she moves.

*She is doing exactly what is required of her, no more, no less.*

- Synergy: I Hereby Declare. Zone plus decree makes a fortress.
- Changed from v0.2: enemies are blocked from entering instead of pushed back.

### MOD-C006 · FOR THE EMPEROR (Rook Fires)
*Ref: Warhammer 40K* · **Tier A** · Cost 4 · Curse 1 · Rook · Cooldown 7 · Modes: All · **Built**

Press the ability button, then click the target. The rook stays put and destroys the first piece on its rank or file, either colour. Kings block the shot and are never hit.

*Nobody asked where the rook got a cannon.*

- Synergy: BOY. A Berserker rook with a cannon is very strong.

### MOD-C007 · This Is Necessary (The Snap)
*Ref: Thanos snap* · **Tier A** · Cost 4 · Curse 0 · Any non-king piece · Once per piece · Modes: All · **Built**

Select a non-king piece and press Sacrifice. It leaves the board and you gain a Tempo Token (max 2). That costs your move. Later, press Extra move under the board before a move: you move again right after. A move that gives check cannot use a token.

*Was this necessary? Yes. Was it worth it? Ask the knight.*

- Synergy: Moneyball. Sacrificed pieces would make Mercenary Tokens.
- Changed from v0.2: added the "no check with a token" rule against double-move mates.

### MOD-C008 · I've Been Waiting For This (En Passant Banked)
*Ref: revenge thriller trope* · **Tier B** · Cost 2 · Curse 0 · Pawn · Cooldown 3 · Modes: All · **Built**

When an enemy pawn double-steps past your pawn, your pawn banks the en passant. For 3 of your moves, select it and press the ability button to take it, as long as both pawns stay put.

- Conflict: 50 First Moves. A banked capture is lost in a blackout.
- Changed from v0.2: both pawns must stay put.

### MOD-C009 · YEET
*Ref: The internet* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your rook shoves an adjacent enemy piece one square straight away from it, if that square is empty. The rook stays put. Uses your move.

*The rook did not ask. The bishop is now somewhere else.*

- Ruling: cannot shove a King, and cannot shove a piece off the board or into a capture.
- Synergy: The Floor Is Lava. Yes. That is what it is for.

### MOD-C010 · Leap Of Faith
*Ref: Assassin's Creed* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your bishop jumps over the first piece on one of its diagonals and lands on the empty square right behind it. No capture. Uses your move.

*The bishop jumped. There was a haystack. There is always a haystack.*

- Ruling: the landing square must be empty and the jump may not leave your King in check.

### MOD-C011 · GET OVER HERE!
*Ref: Mortal Kombat* · **Tier S** · Cost 4 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your Queen pulls the first enemy piece on one of her lines to the square next to her. Uses your move. The piece is not captured, but now it is very close.

*The queen threw a chain. Nobody knows where she got the chain.*

- Ruling: cannot pull a King, and the pull may not leave your own King in check.
- Balance: the pulled piece may defend itself next move. The pull sets up, it does not win.

### MOD-C012 · Freaky Friday
*Ref: Freaky Friday* · **Tier B** · Cost 2 · Curse 0 · Scope: Owner · Modes: All · **Design**

Two of your adjacent pieces swap places. Neither may be your King. Uses your move.

*The knight is the bishop now. The bishop is the knight. They are learning a lot about each other.*

- Ruling: a pawn may not be swapped onto rank 1 or 8.
- Ruling: the swap may not leave your King in check.

### MOD-C013 · Hold My Bread
*Ref: "Hold my beer" meme* · **Tier B** · Cost 2 · Curse 0 · Scope: Owner · Modes: All · **Design**

A pawn guards an adjacent friendly piece. That piece cannot be captured during your opponent's next move. Uses your move.

*The pawn said hold my bread. The bishop held the bread. The bishop survived.*

- Ruling: cannot shield your King. Check is check.

### MOD-C014 · Run, Forrest, Run
*Ref: Forrest Gump* · **Tier B** · Cost 2 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your King runs two squares in a straight line, if both squares are empty and safe. Uses your move.

*Viktor's king just felt like running.*

- Ruling: allowed in check, as long as it ends out of check. It may not run through an attacked square.
- King review: the King only gains movement. Core rule 1 holds.

### MOD-C015 · Ctrl+Z
*Ref: Every computer ever* · **Tier S** · Cost 4 · Curse 0 · Scope: Owner · Modes: All · **Design**

Once per match, before your move, undo the last round: your last move and your opponent's reply both go back. Then you move again.

*Viktor pressed undo. The universe complied. The pigeons noticed.*

- Ruling: random events of that round (lava, storm, gravity) are not rerolled. The seed is kept, so the world repeats.
- Ruling: cannot undo a round that ended the game.

### MOD-C016 · Bullet Time
*Ref: The Matrix* · **Tier A** · Cost 4 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your knight makes two jumps in one move. The first jump cannot capture. The second can.

*Everything slowed down. The knight did not.*

- Ruling: neither jump may leave your King in check, and the knight cannot give check with the first jump.

### MOD-C017 · Get Off My Lawn
*Ref: Gran Torino* · **Tier B** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Every enemy pawn next to your King is pushed one square back toward its own side, if that square is empty. Uses your move.

*Viktor's king has asked the pawns to leave. The pawns have left. They will be back.*

- Ruling: allowed in check only if the push ends the check.

### MOD-C018 · Dirt Hut
*Ref: Minecraft* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your rook places a wall on an empty square next to it. Nothing can land on or cross the wall for 4 rounds. Uses your move.

*Viktor built a wall. It is made of dirt. It is the best wall he has ever built.*

- Ruling: a wall never cuts off the last legal move of either King.
- Safety: at most 2 walls of yours at a time.

### MOD-C019 · Everyone Has A Price
*Ref: Every heist movie* · **Tier S** · Cost 5 · Curse 0 · Scope: Owner · Modes: All · **Design**

An enemy pawn next to your Queen accepts a bribe and joins your side. It must be on its own half of the board. Uses your move.

*Viktor offered bread. The pawn accepted bread. Loyalty is a matter of bread.*

- Ruling: a bribed pawn may not give check on the move it changes sides.
- Balance: on its own half only, so the bribe cannot buy a pawn about to promote.

### MOD-C020 · Gotta Go Fast
*Ref: Sonic the Hedgehog* · **Tier B** · Cost 2 · Curse 0 · Pawn · Cooldown 4 · Scope: Owner · Modes: All · **Built**

Select a pawn and press Dash. It moves two squares forward from any rank, if both squares are empty. No capture. Then that pawn waits 4 of your moves.

*The pawn has been told about promotion. The pawn is in a hurry.*

- Ruling: no en passant can be taken against a dash. I've Been Waiting For This does not bank it either.
- Ruling: the dash may not leave your King in check. It may block a check.
- Ruling: in the Swamp a pawn moves only 1 square, so it cannot dash out.
- Ruling: a pawn slowed by The Cordyceptic Spread has lost its double step, so it cannot dash.
- Ruling: under The Storm Closes In, the last open rank counts as the last rank.
- Changed from design: a dash cannot reach the last rank, so it never promotes. The design gave no cooldown; the build uses 4 of your moves.

## Category D: Fog of War

Information is power. These cards restrict, corrupt, or weaponise visibility. They apply to both players unless stated. All fog cards need per-player views, so none are built yet. Online, the server must never send hidden pieces to a player (see TDD).

### MOD-D001 · It's Dark And I'm Scared
*Ref: Minecraft night* · **Tier S** · Cost 4 · Curse 1 · Scope: Shared · Modes: All · **Built**

Both players see only within 2 squares of their own pieces. The rest is dark. Pigeon pieces are always visible.

- Built: dark squares are drawn as fog. Enemy moves that land in the dark show as "moves in the dark" in the log. Bots plan with the same fog, but always know where the enemy King is.
- Synergy: Forgive Me, For I Have Moved. Reveals the target through fog.
- Synergy: Vent Tiles. Vents are invisible in fog.

### MOD-D002 · I'm Literally Right Here
*Ref: invisible man memes* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Built**

The owner places 2 Ghost Pieces during setup. They look real to the opponent. A Ghost vanishes if an enemy piece passes through its square. The owner sees their Ghosts clearly.

- Conflict: YOU DIED never picks a Ghost.
- Open question: can a Ghost give check? Suggested rule: no, Ghosts never give check or capture.
- Built: the 2 Ghosts are knights or bishops placed at random on the owner's empty third-rank squares. They move like their type and block lines like real pieces, but never capture and never give check. An enemy that captures a Ghost lands normally and an event says it was a Ghost. The owner sees them faded. Sus never picks a Ghost.

### MOD-D003 · What's In The Cloud, Bro
*Ref: smoke cloud memes* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Built**

Every 10 rounds, and on each capture, a 2×2 smoke cloud appears there for 3 rounds. Pieces inside are hidden from the opponent of whoever made the cloud. Movement through smoke is normal.

- Built: a capture cloud covers the capture square (shifted to stay on the board). The timed cloud lands in the middle of the board and belongs to the side that just moved. Both sides see the smoke itself. Bots plan with the same fog, but always know where the enemy King is.

### MOD-D004 · Known Unknowns (The Rumsfeld)
*Ref: Rumsfeld press conference* · **Tier B** · Cost 2 · Curse 1 · Scope: Shared · Modes: All · **Built**

Each player has a 2×2 Blind Spot they cannot see into. Blind Spots differ per player and move every 15 rounds. Players see the outline of their own Blind Spot.

- Built: spots sit in ranks 3-6 and never overlap. Your own pieces inside your spot stay visible. Bots plan with the same fog, but always know where the enemy King is.

### MOD-D005 · Sus (One Of These Is Lying)
*Ref: Among Us* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Built**

One of the owner's pieces looks like a different type to the opponent. It moves like its true self. The King can never be Sus.

- Built: the Sus piece is picked at random from the owner's pieces, and its fake type from pawn, knight, bishop, rook and queen. The opponent's move log shows the fake piece too. The owner sees a "?" badge on it. The disguise ends, with an event, when the piece is captured or promotes.

### MOD-D006 · Cat Mode (Night Vision Activated)
*Ref: cat night vision* · **Tier B** · Cost 1 · Curse 0 · Scope: Owner · Modes: All · **Built**

Adds 1 square to the owner's view range in any fog card. Cat Mode is only offered in the draft once a fog card is already picked, so it is never a dead pick. It cannot see into a Blind Spot.

- Changed from v0.2: draft gating added.
- Built: only It's Dark And I'm Scared has a view range, so the draft waits for that card (picked by either side). The owner sees 3 squares instead of 2. Blind Spots and smoke still hide.

### MOD-D007 · Recalculating… (Move Hints Corrupted)
*Ref: GPS rerouting* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: No Ranked · **Built**

When a player selects a piece, 1 or 2 fake legal-move dots appear. Picking a fake one shows "RECALCULATING…" and the player chooses again (no move lost). Real moves are always shown.

- Note: banked en passant hints are never faked.
- Built: fake dots sit within 3 squares of the piece and never on your own pieces. They stay the same while the piece is selected. Bots are not fooled.

### MOD-D008 · Big Beak Is Watching
*Ref: Big Brother* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Built**

One tile is the Surveillance Square, a golden eye both players see. Any piece that moves within 1 square of it is shown to both players for 3 rounds, through any fog.

- Built: the eye sits in the middle 4×4 and does not move. Moving onto the eye counts. Each sighting is announced in the log, so the card still does something without a fog card.

### MOD-D009 · Invisibility Cloak
*Ref: Harry Potter* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

At match start, pick one of your non-King pieces. It is invisible to your opponent for the first 10 rounds, or until it captures or gives check.

*Viktor's bishop is wearing a cloak. Viktor's opponent is very confused about the missing bishop.*

- Ruling: enemy pieces still cannot move through it. They bump into it and it is revealed.
- Bots: bots play with the same blindness, so it works against them too.

### MOD-D010 · Night Shift
*Ref: Minecraft day and night* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Design**

Every 8 rounds night falls for 4 rounds. At night, each player sees only within 2 squares of their own pieces. The sky in the header shows the time of day.

*It is night. The pigeons have gone to sleep. Viktor has not. Viktor cannot sleep during a match.*

- Conflict: It's Dark And I'm Scared. Already always night. Only one may be in a match.
- Synergy: Cat Mode. Works at night too.

### MOD-D011 · Footprints
*Ref: CSI* · **Tier B** · Cost 1 · Curse 0 · Scope: Owner · Modes: All · **Design**

When an enemy piece moves out of your sight, it leaves footprints on the square it left for 2 rounds. Only offered once a fog card is in the draft.

*Something walked through here. It had small feet. Viktor suspects a pawn.*

- Draft: gated like Cat Mode, so it is never a dead pick.

### MOD-D012 · Flashlight
*Ref: Five Nights at Freddy's* · **Tier B** · Cost 2 · Curse 0 · Scope: Owner · Modes: All · **Design**

Once every 4 of your moves, shine a light on any 3×3 area. You see through fog, smoke and blind spots there for 1 round. It does not use your move. Only offered once a fog card is in the draft.

*Viktor shone the light. Something was there. It was a knight. It was so much worse than a knight.*

- Draft: gated like Cat Mode.

### MOD-D013 · Poker Face
*Ref: Lady Gaga* · **Tier B** · Cost 1 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your opponent's move log shows only the squares your pieces moved to, not which piece moved. Your captured-pieces tray is hidden from them.

*Viktor's face reveals nothing. It never has. That is not the card. That is just Viktor.*

- Ruling: the board itself is unchanged. This only hides the bookkeeping.
- Why: punishes players who read the log instead of the board.

### MOD-D014 · Shell Game
*Ref: The cups and ball trick* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your Queen and two of your pawns look like cups to your opponent. Each cup shows its true piece the first time it moves or is attacked.

*Three cups. One queen. Viktor's opponent is watching very carefully. It will not help.*

- Ruling: the King is never disguised. Core rule 1.
- Not Sus: Sus fakes one piece forever; the shell game hides three until they move.

### MOD-D015 · Camouflage
*Ref: Predator* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Any of your non-King pieces that stays still for 4 of your moves blends in and turns invisible to your opponent. It reappears when it moves, gives check, or is touched by an enemy move.

*The rook has been very still. The rook is part of the board now. The rook has achieved peace.*

- Ruling: enemy moves still bump into hidden pieces, revealing them.
- Skill: rewards patient, planned ambushes.

### MOD-D016 · Jump Scare
*Ref: Five Nights at Freddy's* · **Tier B** · Cost 2 · Curse 1 · Scope: Shared · Modes: All · **Design**

Every 10 rounds the lights go out for one round. Both players make one move with every piece hidden except their own King. A warning flickers the round before.

*The lights went out. Viktor moved his knight from memory. The knight was not where Viktor remembered.*

- Ruling: illegal blind moves are rejected and you pick again. No move is lost.
- Skill: the warning gives a round to memorise the board.

### MOD-D017 · Crystal Ball
*Ref: Fortune tellers* · **Tier B** · Cost 1 · Curse 0 · Scope: Owner · Modes: All · **Design**

You see every timed event two rounds earlier than normal: lava moves, storm waves, gravity shifts, pigeon hops, earthquakes, tides and the like.

*The ball shows lava. The ball always shows lava. This time it is right.*

- Draft: only offered once a card with timed events is in the draft.

### MOD-D018 · Tells
*Ref: Poker* · **Tier B** · Cost 1 · Curse 0 · Scope: Owner · Modes: All · **Design**

You see a glow on every enemy piece whose ability is ready to use, and the number of turns left on the rest.

*The rook twitched. Viktor knows what a twitching rook means.*

- Draft: only offered once your opponent has an ability card.

### MOD-D019 · Spoiler Alert
*Ref: Spoilers, everywhere* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: All · **Design**

After each move, the player must mark which piece they will move next. Both players see the mark. In check, the mark is cancelled.

*Viktor has been told the ending. He is disappointed. He will still play the move.*

- Ruling: if the marked piece has no legal move, any move is allowed.
- Not Forgive Me: that card targets one enemy piece; this binds both players every move.

### MOD-D020 · Masquerade
*Ref: The Phantom of the Opera* · **Tier S** · Cost 4 · Curse 2 · Scope: Shared · Modes: All · **Design**

For the first 6 rounds, every piece except the Kings wears the same mask, for both players. Pieces still move as themselves. Remember your setup.

*Everyone is wearing a mask. Viktor is wearing a mask. Viktor's mask has a better jawline.*

- Ruling: moves are legal by true type; selecting a piece still shows its real moves to its owner.
- Skill: a memory test that the stronger player wins.

## Category E: Asymmetric Armies

Non-standard piece setups. Both players see both armies before the match.

### MOD-E001 · Hatoful Gambit (The Flock Army)
*Ref: Hatoful Boyfriend / pigeon chess meme* · **Tier S** · Cost 5 · Curse 0 · Scope: Owner · Modes: All · **Built**

Both of the owner's knights become Pigeons. Pigeons move like knights. Every 5 rounds each Pigeon announces, one move ahead, a square it will hop to on its own, and then hops there. Hops can capture. Both players see the destination.

- Built: the hop square shows as a dashed teal ring. A hop never takes a King or leaves a King in check. If the square is no longer safe, the Pigeon stays put.
- Gerald will not sit on Pigeons.
- Synergy: Did I Do That? Pigeons can use the rook move.

### MOD-E002 · The Small Council (Do You Hear The Pawns Sing)
*Ref: Les Misérables* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Built**

The owner has no knights or bishops. They start with 8 pawns on their third rank and 4 more behind them on b, c, f and g (12 pawns total). Pawns on the third rank cannot double step.

- Conflict: The Storm Closes In. Crowded endgame.
- Changed from v0.2: 8 pawns on rank 3 and 4 behind, instead of all 12 on rank 3.
- Conflict: Holy Knight. One side cannot draft both.

### MOD-E003 · Yeah, There Are Three Of Them (Royal Guard)
*Ref: John Wick* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Built**

The owner's queen becomes a Royal Guard and a second Guard stands on their third rank. Guards step one square like a King and never castle. They can be captured like any piece. Only the real King matters for check.

- Changed from v0.2: Guards are captured normally instead of being "checkmated".
- Conflict: Slay Queen. One side cannot draft both.

### MOD-E004 · Equivalent Exchange (The Chancellor)
*Ref: Fullmetal Alchemist* · **Tier S** · Cost 5 · Curse 0 · Scope: Owner · Modes: All except Ranked S1 · **Built**

One random rook becomes The Chancellor. Each move it moves like a rook or like a knight. That side loses castling on the Chancellor side.

- Changed from v0.2: the rook is picked at random. Castling on that side is lost.

### MOD-E005 · Twin Telepathy (We Share One Brain)
*Ref: twin telepathy trend* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Built**

When a bishop moves, its twin of the same colour slides the same way up to the same distance. It stops before any piece, never captures, and stays put if blocked by a modifier or if the slide would expose its King.

- Changed from v0.2: same distance, never captures.

### MOD-E006 · BOY. (The Berserker)
*Ref: God of War* · **Tier A** · Cost 4 · Curse 0 · Scope: Owner · Modes: All · **Built**

The game picks the Berserker, never a King or pawn. After it captures, it takes one more capture automatically if one exists. Never more. It skips any capture that would leave its King in check. If the Berserker is captured, the title passes to a random surviving piece. Chain squares flash red.

- Conflict: The Floor Is Lava. A chain cannot land on Lava.
- Changed from v0.2: one extra capture, not an endless chain.

### MOD-E007 · Reject Queen, Embrace Knight (The Underpromoter)
*Ref: "Reject modernity" meme* · **Tier B** · Cost 2 · Curse 1 · Scope: Owner · Modes: All · **Built**

The owner's pawns promote to knight, bishop or rook only. The promoted piece chains one extra capture on its first capture after promotion.

### MOD-E008 · Moneyball (We'll Buy Them Back)
*Ref: Moneyball* · **Tier A** · Cost 4 · Curse 0 · Scope: Owner · Modes: All except Ranked S1 · **Built**

Each piece the owner loses gives a Mercenary Token (max 3). Spend a Token (costs your move) to drop a captured piece onto any empty square as your own. No drop may give check. No pawn drops on rank 1 or 8.

- Built: select your King and press Buy back, pick a square, then pick the piece. Drops show as N@d3 in the move list.
- Ruling: only captures earn tokens. Pieces lost to lava, storm or gravity do not.
- Ruling: a defected Traitor piece that is captured can be bought back. (Not built yet: the build counts the piece's colour when it is captured.)
- Balance flag: the drop-check guard is critical.

### MOD-E009 · Slay Queen (The Amazon)
*Ref: Fairy chess Amazon* · **Tier S** · Cost 5 · Curse 0 · Scope: Owner · Modes: All except Ranked S1 · **Built**

Your Queen can also move like a knight.

*She can go anywhere. She has decided to go everywhere.*

- Built: the Amazon wears an A badge. Her knight jumps leap over pieces and give check like a knight.
- Ruling: only your starting Queen is the Amazon. A queen you promote or buy back later is a normal queen.
- Conflict: Yeah, There Are Three Of Them. It turns your Queen into a Royal Guard, so one side cannot draft both.
- Interaction: They Were The Traitor. If the Amazon defects, she stays an Amazon for her new side.
- Interaction: This Is My Swamp. In the Swamp she moves one square like any queen, with no knight jump.
- Interaction: The Cordyceptic Spread. Infection slows her like any queen. A knight jump counts as 2 squares, so at 1 square of reach she cannot jump.
- Interaction: Sus. A piece disguised as a queen wears the A badge too, so the badge never gives the disguise away.
- Balance: the strongest piece in fairy chess. Full cost, no discount.

### MOD-E010 · Holy Knight (The Archbishop)
*Ref: Capablanca chess* · **Tier A** · Cost 4 · Curse 0 · Scope: Owner · Modes: All except Ranked S1 · **Built**

One of your bishops becomes an Archbishop. Each move, it moves like a bishop or like a knight.

*The bishop prayed for more options. The prayer was answered. The answer had a horse in it.*

- Built: the bishop is picked at random with the seeded generator. The Archbishop has its own piece art (a knight head on a bishop, with a cross) and writes A in the move list.
- Ruling: the Archbishop is not a bishop for other cards. Twin Telepathy does not move it, it cannot Confess (Forgive Me), and it does not clear infection.
- Ruling: it never picks a Ghost bishop (I'm Literally Right Here).
- Interaction: The Cordyceptic Spread. Infection slows it like a bishop. A knight jump counts as 2 squares, so at 1 square of reach it cannot jump.
- Interaction: This Is My Swamp. In the Swamp it moves one square, with no knight jump. It is not stuck the way a knight is.
- Conflict: The Small Council. It has no bishops, so one side cannot draft both.
- Pair: the bishop-side twin of Equivalent Exchange.

### MOD-E011 · Lawrence Of Arabia
*Ref: Lawrence of Arabia* · **Tier B** · Cost 1 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your knights become Camels. A Camel leaps three squares one way and one square the other, jumping over pieces.

*The camel has crossed the desert. The desert was the queenside. Nobody was ready.*

- Balance: a Camel stays on one square colour, like a bishop. Cheap trade, real tradeoffs.

### MOD-E012 · Hopscotch
*Ref: Fairy chess Grasshopper* · **Tier B** · Cost 2 · Curse 0 · Scope: Owner · Modes: All · **Design**

One of your rooks becomes a Grasshopper. It moves along any queen line but must hop over exactly one piece and land on the square right behind it, capturing anything there.

*It needs something to jump over. It is always looking for something to jump over. It is exhausting.*

- Ruling: with nothing to hop over, a Grasshopper cannot move. It still gives check by hopping.

### MOD-E013 · Overseas Hire (The Cannon)
*Ref: Xiangqi, Chinese chess* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

One of your rooks becomes a Cannon. It moves like a rook, but captures only by jumping over exactly one piece on its line to take the next one.

*The cannon arrived from abroad. It brought its own rules. It is very proud of them.*

- Ruling: the Cannon gives check only through a screen piece, like in xiangqi.

### MOD-E014 · Crab Rave
*Ref: Crab Rave* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your pawns can also step one square sideways onto an empty square. They still capture only diagonally forward.

*The pawns have learned to walk sideways. The pawns will not stop walking sideways.*

- Ruling: a sideways step is not a double step and gives no en passant.

### MOD-E015 · Stonks
*Ref: Stonks meme* · **Tier B** · Cost 2 · Curse 0 · Scope: Owner · Modes: All · **Design**

Start the match with two fewer pawns (the a- and h-pawns) and an extra knight on b3.

*Viktor sold two pawns. Viktor bought a horse. The market reacted.*

- Balance: two pawns are worth about one knight. The trade buys tempo, not material.

### MOD-E016 · Hatchery
*Ref: Pigeons, and their eggs* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

A pigeon Egg sits on your d3 square. It cannot move. If it survives 10 rounds, it hatches into a Pigeon, which moves like a knight.

*Viktor is guarding an egg. The egg is the most important piece on the board. The egg disagrees.*

- Ruling: the Egg can be captured like a pawn, and it blocks like any piece.
- Synergy: Hatoful Gambit. Your flock grows to three.

### MOD-E017 · The Bodyguard
*Ref: The Bodyguard (1992)* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

A Bodyguard replaces your g-pawn. It moves like a King. As its move, it may swap places with your King if they are next to each other.

*He will take the check for the King. He has said this many times. Nobody asked.*

- Ruling: a swap may not leave your King in check, and a swap out of check is allowed if it ends the check.
- King review: the King only gains a way out. Core rule 1 holds.

### MOD-E018 · Zerg Rush
*Ref: StarCraft* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your pawns may move two squares forward from any rank, if both squares are empty. They capture normally.

*The pawns are coming. All of them. Right now.*

- Ruling: en passant works against every two-square move, from any rank.
- Not Gotta Go Fast: that is one pawn on a cooldown; this is all of them, always.

### MOD-E019 · Knight Rider
*Ref: Knight Rider (KITT)* · **Tier A** · Cost 4 · Curse 0 · Scope: Owner · Modes: All · **Design**

Your knights may repeat the same L-jump in a straight line, as long as each landing square is empty, stopping on or capturing at the last.

*The knight has a talking car. The knight will not stop talking about the talking car.*

- Ruling: known in fairy chess as the Nightrider.

### MOD-E020 · Elephant In The Room
*Ref: Xiangqi elephants* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Design**

Your bishops become Elephants. An Elephant moves exactly two squares diagonally, jumping over the square between.

*Nobody is talking about the elephants. The elephants are fine with this.*

- Pricing: a weaker piece, so the card pays back a point, like a curse.

## Balance summary

Values the game uses today. "Built" cards match the build.

| ID | Name | Cat | Tier | Cost | Curse | Scope | Status |
|---|---|---|---|---|---|---|---|
| A001 | The Cordyceptic Spread | A | S | 4 | 1 | Shared | Built |
| A002 | The Floor Is Lava | A | A | 3 | 1 | Shared | Built |
| A003 | Vent Tiles | A | B | 2 | 0 | Shared | Built |
| A004 | Winter Is Coming | A | B | 2 | 0 | Shared | Built |
| A005 | The Storm Closes In | A | A | 3 | 1 | Shared | Built |
| A006 | This Is My Swamp | A | B | 2 | 0 | Shared | Built |
| A007 | Gravitational Anomaly | A | S | 5 | 2 | Shared | Built |
| A008 | Bandersnatch Protocol | A | A | 3 | 1 | Shared | Built |
| B001 | YOU DIED | B | S | -3 | 3 | Owner | Built |
| B002 | Distracted Piece | B | A | -2 | 2 | Owner | Built |
| B003 | No, I Don't Think I Will | B | B | -1 | 1 | Owner | Built |
| B004 | Heavy Is The Crown | B | A | -2 | 2 | Owner | Built |
| B005 | 50 First Moves | B | A | -2 | 2 | Owner | Built |
| B006 | They Were The Traitor | B | S | -3 | 3 | Owner | Built |
| B007 | Conscientious Objector | B | B | -1 | 1 | Owner | Built |
| B008 | 7/10, Too Many Pieces | B | B | 0 | 0 | Owner | Built |
| C001 | I Hereby Declare | C | S | 4 | 0 | Owner | Built |
| C002 | Forgive Me, For I Have Moved | C | A | 3 | 0 | Owner | Built |
| C003 | Did I Do That? | C | A | 3 | 0 | Owner | Built |
| C004 | Retaliatory Swipe | C | B | 2 | 0 | Owner | Built |
| C005 | Quiet Quitting | C | S | 5 | 0 | Owner | Built |
| C006 | FOR THE EMPEROR | C | A | 4 | 1 | Owner | Built |
| C007 | This Is Necessary | C | A | 4 | 0 | Owner | Built |
| C008 | I've Been Waiting For This | C | B | 2 | 0 | Owner | Built |
| D001 | It's Dark And I'm Scared | D | S | 4 | 1 | Shared | Built |
| D002 | I'm Literally Right Here | D | A | 3 | 0 | Owner | Built |
| D003 | What's In The Cloud, Bro | D | B | 2 | 0 | Shared | Built |
| D004 | Known Unknowns | D | B | 2 | 1 | Shared | Built |
| D005 | Sus | D | A | 3 | 0 | Owner | Built |
| D006 | Cat Mode | D | B | 1 | 0 | Owner | Built |
| D007 | Recalculating… | D | A | 3 | 1 | Shared | Built |
| D008 | Big Beak Is Watching | D | B | 2 | 0 | Shared | Built |
| E001 | Hatoful Gambit | E | S | 5 | 0 | Owner | Built |
| E002 | The Small Council | E | A | 3 | 0 | Owner | Built |
| E003 | Yeah, There Are Three Of Them | E | A | 3 | 0 | Owner | Built |
| E004 | Equivalent Exchange | E | S | 5 | 0 | Owner | Built |
| E005 | Twin Telepathy | E | B | 2 | 0 | Shared | Built |
| E006 | BOY. | E | A | 4 | 0 | Owner | Built |
| E007 | Reject Queen, Embrace Knight | E | B | 2 | 1 | Owner | Built |
| E008 | Moneyball | E | A | 4 | 0 | Owner | Built |
| A009 | The Birds (Hitchcock Mode) | A | B | 2 | 0 | Shared | Design |
| A010 | The Factory Must Grow | A | A | 3 | 1 | Shared | Design |
| A011 | Thinking With Portals | A | B | 2 | 0 | Shared | Design |
| A012 | Let It Go | A | A | 3 | 1 | Shared | Design |
| A013 | The Magic Roundabout | A | B | 2 | 0 | Shared | Design |
| A014 | Minesweeper | A | A | 3 | 1 | Shared | Design |
| A015 | The Roomba | A | B | 2 | 0 | Shared | Design |
| A016 | Monument To Gerald | A | B | 1 | 0 | Shared | Design |
| A017 | Tide Goes In, Tide Goes Out | A | A | 3 | 1 | Shared | Design |
| A018 | Shake It Off | A | S | 4 | 2 | Shared | Design |
| A019 | Crop Circles | A | B | 2 | 0 | Shared | Design |
| A020 | One Way Street | A | B | 2 | 1 | Shared | Design |
| B009 | Speedrun Any% | B | A | -2 | 2 | Owner | Design |
| B010 | Main Character Syndrome | B | B | -1 | 1 | Owner | Design |
| B011 | Case Of The Mondays | B | B | -1 | 1 | Owner | Design |
| B012 | Bless You | B | B | -1 | 1 | Owner | Design |
| B013 | Death And Taxes | B | S | -3 | 3 | Owner | Design |
| B014 | Imposter Syndrome | B | B | -1 | 1 | Owner | Design |
| B015 | Commitment Issues | B | B | -1 | 1 | Owner | Built |
| B016 | Lunch Break | B | A | -2 | 2 | Owner | Design |
| B017 | MINE! | B | A | -2 | 2 | Owner | Design |
| B018 | Rubber Banding | B | A | -2 | 2 | Owner | Design |
| B019 | Peer Pressure | B | A | -2 | 2 | Owner | Built |
| B020 | Roll For Initiative | B | A | -2 | 2 | Owner | Design |
| C009 | YEET | C | A | 3 | 0 | Owner | Design |
| C010 | Leap Of Faith | C | A | 3 | 0 | Owner | Design |
| C011 | GET OVER HERE! | C | S | 4 | 0 | Owner | Design |
| C012 | Freaky Friday | C | B | 2 | 0 | Owner | Design |
| C013 | Hold My Bread | C | B | 2 | 0 | Owner | Design |
| C014 | Run, Forrest, Run | C | B | 2 | 0 | Owner | Design |
| C015 | Ctrl+Z | C | S | 4 | 0 | Owner | Design |
| C016 | Bullet Time | C | A | 4 | 0 | Owner | Design |
| C017 | Get Off My Lawn | C | B | 3 | 0 | Owner | Design |
| C018 | Dirt Hut | C | A | 3 | 0 | Owner | Design |
| C019 | Everyone Has A Price | C | S | 5 | 0 | Owner | Design |
| C020 | Gotta Go Fast | C | B | 2 | 0 | Owner | Built |
| D009 | Invisibility Cloak | D | A | 3 | 0 | Owner | Design |
| D010 | Night Shift | D | A | 3 | 1 | Shared | Design |
| D011 | Footprints | D | B | 1 | 0 | Owner | Design |
| D012 | Flashlight | D | B | 2 | 0 | Owner | Design |
| D013 | Poker Face | D | B | 1 | 0 | Owner | Design |
| D014 | Shell Game | D | A | 3 | 0 | Owner | Design |
| D015 | Camouflage | D | A | 3 | 0 | Owner | Design |
| D016 | Jump Scare | D | B | 2 | 1 | Shared | Design |
| D017 | Crystal Ball | D | B | 1 | 0 | Owner | Design |
| D018 | Tells | D | B | 1 | 0 | Owner | Design |
| D019 | Spoiler Alert | D | A | 3 | 1 | Shared | Design |
| D020 | Masquerade | D | S | 4 | 2 | Shared | Design |
| E009 | Slay Queen (The Amazon) | E | S | 5 | 0 | Owner | Built |
| E010 | Holy Knight (The Archbishop) | E | A | 4 | 0 | Owner | Built |
| E011 | Lawrence Of Arabia | E | B | 1 | 0 | Owner | Design |
| E012 | Hopscotch | E | B | 2 | 0 | Owner | Design |
| E013 | Overseas Hire (The Cannon) | E | A | 3 | 0 | Owner | Design |
| E014 | Crab Rave | E | A | 3 | 0 | Owner | Design |
| E015 | Stonks | E | B | 2 | 0 | Owner | Design |
| E016 | Hatchery | E | A | 3 | 0 | Owner | Design |
| E017 | The Bodyguard | E | A | 3 | 0 | Owner | Design |
| E018 | Zerg Rush | E | A | 3 | 0 | Owner | Design |
| E019 | Knight Rider | E | A | 4 | 0 | Owner | Design |
| E020 | Elephant In The Room | E | B | -1 | 1 | Owner | Design |

45 of 100 built. The other 55 are designs (v0.4).

### Balance test plan

Rule 07 needs win-rate data, but there are no live players yet. Until there are:

1. Run bot-vs-bot games offline with the Pigeon bot on both sides.
2. For each built card, play a few hundred games with that card on one side only.
3. Log the win rate of the side with the card. Flag any card outside 40% to 60%.
4. Also log skipped turns and draws, to catch softlock risks (Rule 06).

The harness is built: `pnpm --filter @pigeon-chess/game-core balance` plays the games and writes `docs/balance-report.md`. It uses Pigeon at depth 1 so a full run finishes in minutes. Settings are environment variables (see `packages/game-core/scripts/balance.run.ts`).

### Known balance watch list

- **Distracted Piece:** likely under-priced (see Curse pricing).
- **YOU DIED + Traitor:** together they give 6 points. The draft caps (max 5 cards, max 2 per category) limit abuse. Watch it.
- **Cat Mode:** gated in the draft so it is never a dead pick.

## Modifier design rules

**Rule 01. The Laugh Test.** Every modifier must make a player laugh, groan, or say "what?" at least once per match. Frustration without delight means rewrite.

**Rule 02. The Rematch Test.** After losing with a modifier active, the loser should want to play again. If it makes players want to quit, nerf or remove it.

**Rule 03. The Legibility Rule.** Every effect must be clear at a glance. If it needs a tooltip mid-game, simplify it. Every built card shows its real rules in the draft.

**Rule 04. The King Is Sacred.** See Core rule 1. Every King-touching card needs a second review.

**Rule 05. Server Authority.** In online games, all modifier logic runs on the server. Offline games (bots, practice, local) run the same game-core code in the browser.

**Rule 06. No Softlocks.** Any interaction that could stop the game from ending must be tested. Core rule 4 is the safety net. Softlock risk means the pair is banned or a forced-draw rule is added.

**Rule 07. Balance Patch Cadence.** Costs change in 0.5 pt steps. No card above 60% or below 40% win rate in its bracket after 2 weeks of data.

**Rule 08. Curse Must Pay.** Every curse must grant enough points that a skilled player can build around it. A curse with no downside grants 0.

**Rule 09. Ranked Pool Curation.** Not every card enters Ranked every season. New cards spend one season in Casual first.

**Rule 10. Interactions Are Features.** Surprising combos are content, not bugs. Document them. Only patch combos that break Rule 04 or Rule 06.
