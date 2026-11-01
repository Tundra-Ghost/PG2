# Pigeon Chess: Modifier Design Bible

**Ref:** PC-MOD-001 · **Version:** 0.3 · **Status:** Draft, pre-production
**Related:** [GDD](gdd.md) · [TDD](tdd.md) · [Art Direction](art-direction.md) · [Hook model](modifier-hook-model.md)

40 modifiers in 5 categories. Max curse 3. Max cost 5 pts.

| Code | Category | What it does |
|---|---|---|
| A | Board Mutations | Tiles that change, move, or destroy |
| B | Cursed | Negative effects that grant points |
| C | Active Abilities | Cooldown powers on piece types |
| D | Fog of War | Information and visibility variants |
| E | Asymmetric Armies | Non-standard piece configurations |

## Change log

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

Four tiles are Lava. A piece that lands on Lava is lost, either colour. Kings are immune. Lava moves every 3 moves (counting both players). There is no preview of the next spot yet. When a piece burns, its square flashes.

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
*Ref: Black Mirror* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: Casual, Story · **Design**

The board is split by an invisible axis. A move on one half is mirrored on the other half. Pieces colliding on the axis swap places. Kings are exempt. Both players are affected equally.

*Every choice echoes.*

- Synergy: I'm Literally Right Here. Mirrored decoys add confusion.
- Balance flag: needs edge case tests with castling.
- Open question: which piece mirrors? The design text says "for that piece", which is unclear. Define before building.

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
*Ref: "No, I don't think I will" meme* · **Tier B** · Cost -1 · Curse 1 · Scope: Owner · Modes: All · **Design**

For the owner's first 5 moves, every piece moves in the opposite direction to the click. Forward becomes backward, left becomes right. Moves still have to be legal.

- Synergy: Winter Is Coming. Inverted moves near frozen zones are risky.
- Open question: what is the "opposite" of a knight jump or a castle? Define before building.

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
*Ref: Confession Bear* · **Tier A** · Cost 3 · Curse 0 · Bishop · Cooldown 5 · Modes: All · **Design**

Target one enemy piece. For 2 of the opponent's moves, that piece must show its destination one move early. A ghost outline shows where it will go.

- Synergy: fog cards. The confession reveals the target through fog and shows if it is a decoy or Sus.

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

## Category D: Fog of War

Information is power. These cards restrict, corrupt, or weaponise visibility. They apply to both players unless stated. All fog cards need per-player views, so none are built yet. Online, the server must never send hidden pieces to a player (see TDD).

### MOD-D001 · It's Dark And I'm Scared
*Ref: Minecraft night* · **Tier S** · Cost 4 · Curse 1 · Scope: Shared · Modes: All · **Built**

Both players see only within 2 squares of their own pieces. The rest is dark. Pigeon pieces are always visible.

- Built: dark squares are drawn as fog. Enemy moves that land in the dark show as "moves in the dark" in the log. Bots still see the whole board for now.
- Synergy: Forgive Me, For I Have Moved. Reveals the target through fog.
- Synergy: Vent Tiles. Vents are invisible in fog.

### MOD-D002 · I'm Literally Right Here
*Ref: invisible man memes* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

The owner places 2 Ghost Pieces during setup. They look real to the opponent. A Ghost vanishes if an enemy piece passes through its square. The owner sees their Ghosts clearly.

- Conflict: YOU DIED never picks a Ghost.
- Open question: can a Ghost give check? Suggested rule: no, Ghosts never give check or capture.

### MOD-D003 · What's In The Cloud, Bro
*Ref: smoke cloud memes* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Design**

Every 10 rounds, and on each capture, a 2×2 smoke cloud appears there for 3 rounds. Pieces inside are hidden from the opponent of whoever made the cloud. Movement through smoke is normal.

### MOD-D004 · Known Unknowns (The Rumsfeld)
*Ref: Rumsfeld press conference* · **Tier B** · Cost 2 · Curse 1 · Scope: Shared · Modes: All · **Built**

Each player has a 2×2 Blind Spot they cannot see into. Blind Spots differ per player and move every 15 rounds. Players see the outline of their own Blind Spot.

- Built: spots sit in ranks 3-6 and never overlap. Your own pieces inside your spot stay visible. Bots still see the whole board.

### MOD-D005 · Sus (One Of These Is Lying)
*Ref: Among Us* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Design**

One of the owner's pieces looks like a different type to the opponent. It moves like its true self. The King can never be Sus.

### MOD-D006 · Cat Mode (Night Vision Activated)
*Ref: cat night vision* · **Tier B** · Cost 1 · Curse 0 · Scope: Owner · Modes: All · **Design**

Adds 1 square to the owner's view range in any fog card. Cat Mode is only offered in the draft once a fog card is already picked, so it is never a dead pick. It cannot see into a Blind Spot.

- Changed from v0.2: draft gating added.

### MOD-D007 · Recalculating… (Move Hints Corrupted)
*Ref: GPS rerouting* · **Tier A** · Cost 3 · Curse 1 · Scope: Shared · Modes: No Ranked · **Built**

When a player selects a piece, 1 or 2 fake legal-move dots appear. Picking a fake one shows "RECALCULATING…" and the player chooses again (no move lost). Real moves are always shown.

- Note: banked en passant hints are never faked.
- Built: fake dots sit within 3 squares of the piece and never on your own pieces. They stay the same while the piece is selected. Bots are not fooled.

### MOD-D008 · Big Beak Is Watching
*Ref: Big Brother* · **Tier B** · Cost 2 · Curse 0 · Scope: Shared · Modes: All · **Built**

One tile is the Surveillance Square, a golden eye both players see. Any piece that moves within 1 square of it is shown to both players for 3 rounds, through any fog.

- Built: the eye sits in the middle 4×4 and does not move. Moving onto the eye counts. Each sighting is announced in the log, so the card still does something without a fog card.

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

### MOD-E003 · Yeah, There Are Three Of Them (Royal Guard)
*Ref: John Wick* · **Tier A** · Cost 3 · Curse 0 · Scope: Owner · Modes: All · **Built**

The owner's queen becomes a Royal Guard and a second Guard stands on their third rank. Guards step one square like a King and never castle. They can be captured like any piece. Only the real King matters for check.

- Changed from v0.2: Guards are captured normally instead of being "checkmated".

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
| A008 | Bandersnatch Protocol | A | A | 3 | 1 | Shared | Design |
| B001 | YOU DIED | B | S | -3 | 3 | Owner | Built |
| B002 | Distracted Piece | B | A | -2 | 2 | Owner | Built |
| B003 | No, I Don't Think I Will | B | B | -1 | 1 | Owner | Design |
| B004 | Heavy Is The Crown | B | A | -2 | 2 | Owner | Built |
| B005 | 50 First Moves | B | A | -2 | 2 | Owner | Built |
| B006 | They Were The Traitor | B | S | -3 | 3 | Owner | Built |
| B007 | Conscientious Objector | B | B | -1 | 1 | Owner | Built |
| B008 | 7/10, Too Many Pieces | B | B | 0 | 0 | Owner | Built |
| C001 | I Hereby Declare | C | S | 4 | 0 | Owner | Built |
| C002 | Forgive Me, For I Have Moved | C | A | 3 | 0 | Owner | Design |
| C003 | Did I Do That? | C | A | 3 | 0 | Owner | Built |
| C004 | Retaliatory Swipe | C | B | 2 | 0 | Owner | Built |
| C005 | Quiet Quitting | C | S | 5 | 0 | Owner | Built |
| C006 | FOR THE EMPEROR | C | A | 4 | 1 | Owner | Built |
| C007 | This Is Necessary | C | A | 4 | 0 | Owner | Built |
| C008 | I've Been Waiting For This | C | B | 2 | 0 | Owner | Built |
| D001 | It's Dark And I'm Scared | D | S | 4 | 1 | Shared | Built |
| D002 | I'm Literally Right Here | D | A | 3 | 0 | Owner | Design |
| D003 | What's In The Cloud, Bro | D | B | 2 | 0 | Shared | Design |
| D004 | Known Unknowns | D | B | 2 | 1 | Shared | Built |
| D005 | Sus | D | A | 3 | 0 | Owner | Design |
| D006 | Cat Mode | D | B | 1 | 0 | Owner | Design |
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

33 of 40 built. Scope for Design cards is a proposal.

### Balance test plan

Rule 07 needs win-rate data, but there are no live players yet. Until there are:

1. Run bot-vs-bot games offline with the Pigeon bot on both sides.
2. For each built card, play a few hundred games with that card on one side only.
3. Log the win rate of the side with the card. Flag any card outside 40% to 60%.
4. Also log skipped turns and draws, to catch softlock risks (Rule 06).

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
