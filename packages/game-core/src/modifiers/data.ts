/* ═══════════════════════════════════════════════════════
   PIGEON CHESS — MODIFIER BIBLE v0.2
   All 40 modifiers, 5 categories (A–E), 8 per category
═══════════════════════════════════════════════════════ */

export type ModifierCategory = 'A' | 'B' | 'C' | 'D' | 'E';
export type ModifierTier = 'S' | 'A' | 'B';
export type CurseLevel = 0 | 1 | 2 | 3;

export interface ModifierCard {
  id: string;
  name: string;
  category: ModifierCategory;
  categoryName: string;
  typeLine: string;
  cost: number;        // positive = spends budget · negative = grants budget
  curseLevel: CurseLevel;
  tier: ModifierTier;
  description: string;
  flavor: string;
  /**
   * How this card actually plays in the current build, when that differs
   * from the design text above. Shown under the description so drafts never
   * promise rules the engine does not have (GDD Pillar 1). Required for
   * every registered modifier.
   */
  prototypeRules?: string;
  /**
   * Whether one card covers both players (shared) or each side drafts its own
   * (owned). Built cards declare this on their definition; this field gives
   * design cards a scope before they are built.
   */
  scope?: 'shared' | 'owned';
}

export const CATEGORY_COLORS: Record<ModifierCategory, string> = {
  A: '#e8a23a', // Board Mutations — amber
  B: '#c0392b', // Cursed          — chaos red
  C: '#3a9de8', // Active Abilities — blue
  D: '#7c3ae8', // Fog of War      — purple
  E: '#3ae87c', // Asymmetric Armies — green
};

export const CATEGORY_NAMES: Record<ModifierCategory, string> = {
  A: 'Board Mutations',
  B: 'Cursed',
  C: 'Active Abilities',
  D: 'Fog of War',
  E: 'Asymmetric Armies',
};

export const ALL_MODIFIERS: ModifierCard[] = [

  // ── CATEGORY A — BOARD MUTATIONS ──────────────────────────────────────────

  {
    id: 'MOD-A001',
    name: 'The Cordyceptic Spread',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Persistent · Mid-Match Trigger',
    cost: 4,
    curseLevel: 1,
    tier: 'S',
    description:
      'Every 5 turns, one random empty tile becomes Infected. Pieces standing still on Infected tiles lose 1 square of movement per turn. A Bishop or Queen passing through clears infection. 25% chance to spread to an adjacent tile each turn.',
    flavor: '"There is something growing on the board. Viktor has chosen not to investigate what it is."',
    prototypeRules:
      'A new Infected tile appears every 5 rounds. Each round, every Infected tile has a 25% chance to spread to a neighbour. Rooks, bishops and queens standing still on infection lose 1 square of reach per round. Pawns lose their double step. Knights, kings, leapers (Pigeons, Elephants, Camels) and Nightriders are not slowed. A bishop or queen clears every square it crosses. Lava burns infection away.',
  },
  {
    id: 'MOD-A002',
    name: 'The Floor Is Lava',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Persistent · Rotating',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    description:
      'Four tiles are Lava. Any piece landing on Lava is immediately captured — including your own. Every 10 turns, each Lava tile rotates clockwise one square. Next position is shown as an amber outline one turn in advance.',
    flavor: '"The floor is lava. Viktor\'s knight is on the floor. Viktor is processing this."',
    prototypeRules:
      'Lava moves every 3 moves, counting both players. The next 4 spots show a dashed amber outline. Kings are immune.',
  },
  {
    id: 'MOD-A003',
    name: 'Vent Tiles',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Hidden · One-Time',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'Three tiles are secretly Vents at match start. The first piece landing on a Vent teleports to the diametrically opposite square, capturing whatever is there. Once used, Vents become impassable shafts.',
    flavor: '"Viktor\'s bishop vanished and reappeared behind enemy lines. Viktor did not do that on purpose."',
    prototypeRules:
      'Three hidden vents spawn on ranks 3 to 6. The first non-king piece to land on one jumps to the opposite square and captures whatever is there, either colour. Then the vent becomes a shaft no piece can enter or cross. A vent jams (and stays hidden) if the exit holds a king or the jump would expose your king.',
  },
  {
    id: 'MOD-A004',
    name: 'Winter Is Coming (To Your Pieces)',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Persistent · Zone',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'Both home rows (Ranks 1–3 and 6–8) are Frozen. Any piece entering a Frozen zone must thaw for 1 full turn before moving. Pawns freeze before promoting. Kings cannot castle if either path tile is Frozen.',
    flavor: '"Viktor\'s entire back rank is frozen. A raven arrived to warn him. Viktor does not know how to talk to ravens."',
    prototypeRules:
      'Ranks 1-3 and 6-8 are frozen. A piece that enters from ranks 4-5 must wait one turn. Castling is blocked.',
  },
  {
    id: 'MOD-A005',
    name: 'The Storm Closes In',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Shrinking · Progressive',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    description:
      'The outer ring of the board is consumed by Storm every 8 turns. Pieces on Storm tiles are eliminated. Board shrinks from 8×8 toward 6×6 by turn 40.',
    flavor: '"The board is getting smaller. Viktor is getting calmer. These things are unrelated."',
    prototypeRules:
      'Every 8 full turns the storm takes part of the outer ring: corners first, edge middles last. Full 6×6 after turn 32. Squares about to go are striped one wave ahead. Pieces caught are lost; kings are spared until they step off. Nothing can enter or cross storm squares. Once the square ahead is storm, a pawn promotes on the last open rank.',
  },
  {
    id: 'MOD-A006',
    name: 'This Is My Swamp',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Zone · Symmetric',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'The four central squares (d4, d5, e4, e5) are the Swamp. Any piece in the Swamp moves at 1 square per turn. Knights and other leapers are trapped for 2 turns upon entering.',
    flavor: '"Viktor entered the Swamp to seize the centre. The Swamp seized Viktor. They are negotiating terms."',
    prototypeRules:
      'A piece that starts its move in the Swamp moves only 1 square, captures included. Pieces may still slide through. A knight or other leaper (Pigeon, Elephant, Camel, Nightrider) that lands in the Swamp is stuck for 2 turns, then leaps out normally (a Nightrider with a single jump). Swamp pieces still give check at full range.',
  },
  {
    id: 'MOD-A007',
    name: 'Gravitational Anomaly',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Directional · Triggered',
    cost: 5,
    curseLevel: 2,
    tier: 'S',
    description:
      'Every 12 turns, gravity flips. All pieces slide 1 square toward the new bottom edge. Pieces sliding off the board are captured. Pawns re-orient to new gravity. Kings slide too.',
    flavor: '"Viktor\'s rook slid sideways. Viktor\'s pawns are now facing east. Viktor is not thinking about it."',
    prototypeRules:
      'Every 12 full turns gravity pulls sideways, east then west, back and forth. Everything slides one square that way, with a warning the move before. Pieces pushed off the edge are lost; kings brace and stay. Pawns keep their direction, and a pawn pushed onto its last rank becomes a queen. Castling is gone after the first shift.',
  },
  {
    id: 'MOD-A008',
    name: 'Bandersnatch Protocol',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Structural · Persistent',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    description:
      'The board is split by an invisible axis. Any move on the left half is simultaneously mirrored on the right for that piece. Pieces colliding on the axis swap positions. Kings are exempt.',
    flavor: '"Viktor moved his bishop left. His bishop also moved right. Viktor is questioning his own free will."',
    prototypeRules:
      'A line splits the board between the d and e files. When you move a piece, your piece on the mirror of its start square (c1 and f1 are twins) makes the mirrored move, if that move is legal for it. It can capture. Kings never mirror, and abilities and castling are not mirrored.',
  },

  // Design cards (not built yet): Board Mutations 009-020

  {
    id: 'MOD-A009',
    name: 'The Birds (Hitchcock Mode)',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Pigeon Flock · Temporary',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'shared',
    description:
      'Every 6 rounds a flock lands on a random empty 2×2 area of ranks 3 to 6. Nothing can land on or cross those squares for 2 rounds. The landing spot is shown one round ahead.',
    prototypeRules:
      'Every 6 rounds (rounds 7, 13, 19, ...) a flock lands on a random 2×2 block of empty squares on ranks 3 to 6, chosen with the game seed. The block is marked one round ahead. If a piece steps into the marked block, the flock picks another open block when it lands. For 2 rounds nothing can land on or slide through those squares, and they block check. Knights still jump over. A flock never lands where it would take away the last legal move of either King, and skips its landing if no block is open. A flock that shields a King from check stays until it no longer does.',
    flavor: '"The pigeons have chosen a spot. It is the spot Viktor needed. This is not a coincidence."',
  },
  {
    id: 'MOD-A010',
    name: 'The Factory Must Grow',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Conveyor · Every Round',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    scope: 'shared',
    description:
      'Ranks 4 and 5 are conveyor belts. At the end of each round, every piece on rank 4 slides one square right and every piece on rank 5 slides one square left. A piece stops at the board edge or behind another piece. Arrows show the belt direction.',
    prototypeRules:
      'After every round (once Black has moved) each piece on rank 4 slides one square right and each piece on rank 5 one square left. The front piece moves first, so a line of pieces moves together. A piece stays put at the board edge, behind a piece that cannot move, or before a wall, flock, statue, storm or Lava square. Belts never capture. No slide may put a King in check, so a King rides only to a safe square, and a piece shielding a King from check stays. Belts stop while Tide Goes In floods ranks 4 and 5. A belt never uses a portal. Whenever a pawn slides, en passant is off for that turn. A hidden piece that blocks the belt is revealed. A piece carried out of the Swamp is no longer stuck.',
    flavor: '"Viktor placed his knight on the belt. The knight is now somewhere else. The factory is pleased."',
  },
  {
    id: 'MOD-A011',
    name: 'Thinking With Portals',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Teleport · Permanent',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'shared',
    description:
      'A blue portal sits on c4 and an orange portal on f5. A non-King piece that ends its move on one portal steps out of the other, if that square is empty. Portals never capture and stay all match.',
    prototypeRules:
      'Blue portal on c4, orange portal on f5, for the whole match. A non-King piece of the side that moved, ending a normal move (a capture too) on one portal, is moved straight to the other portal. If that square holds any piece, is blocked (a wall, a flock, the statue), or the jump would leave its own King in check, the piece stays on the entry portal. Abilities do not use the portals. A pawn that double-steps onto a portal and jumps cannot be taken en passant.',
    flavor: '"Viktor\'s rook entered on the left. It left on the right. Viktor is still on the left."',
  },
  {
    id: 'MOD-A012',
    name: 'Let It Go',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Ice · Zone',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    scope: 'shared',
    description:
      'The central 4×4 squares are ice. A rook, bishop or queen that moves onto ice keeps sliding the same way until it reaches the edge of the ice or the square before a piece. It may still capture the piece it was moving to.',
    prototypeRules:
      'c3 to f6 is ice. A rook, bishop or queen whose move ends on ice without capturing keeps sliding the same way, one square at a time, until the next square is off the ice, holds a piece or anything a piece cannot land on (statue, wall, flock, Lava, storm, used vent), or would leave its own King in check. A capture stops the piece where it captured. Knights, pawns, Kings and other pieces are not affected, nor are abilities, castling or pieces moved by other cards. The slide may give check. A hidden piece of either side that stops a slide is revealed. Under Winter Is Coming only the square the move ends on counts, so a piece that slides into the Frozen zone is not frozen.',
    flavor: '"The queen stepped onto the ice. The queen is now on the other side of the ice. The queen did not plan this."',
  },
  {
    id: 'MOD-A013',
    name: 'The Magic Roundabout',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Rotation · Every Round',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'shared',
    description:
      'The four centre squares are a roundabout. At the end of each round, pieces on d4, e4, e5 and d5 move one step clockwise around it, if the next square is free.',
    prototypeRules:
      'After every round (once Black has moved) each piece on d4, e4, e5 and d5 moves one step clockwise as White sees it (d5 to e5 to e4 to d4 to d5), if the next square is free. A piece whose next square empties follows, so a queue of three turns together; with all four squares full nothing moves. Each piece moves once per round at most. It never captures. No turn may put a King in check or add a checker against it, so a King turns only to a safe square. A hidden piece that blocks a turn is revealed. Not in a match with This Is My Swamp, Tide Goes In, Crop Circles, The Factory Must Grow or Monument To Gerald.',
    flavor: '"Viktor entered the roundabout in round 6. He is still deciding where to exit."',
  },
  {
    id: 'MOD-A014',
    name: 'Minesweeper',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Hidden · Deduction',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    scope: 'shared',
    description:
      'Four hidden mines sit on ranks 3 to 6, two on each half of the board. When a piece stops next to a mine, its square shows how many mines touch it, like the classic game. The first non-King piece to land on a mine is lost and the mine is used up.',
    prototypeRules:
      'Four hidden mines are placed with the game seed: two on ranks 3 and 4, two on ranks 5 and 6, never under a piece and never next to a King. When a piece makes a normal move that ends on a mine, it is lost and the mine is used up. Kings never set one off. A mine that would leave its own side\'s King in check stays hidden instead. A piece that stops anywhere else leaves a number on its square: how many live mines touch it (0 to 8). Numbers update when a mine is used. Abilities and pieces moved by other cards do not set off mines. Online, the mines are never sent, and a clue left by a hidden piece or on a square in fog is not shown (the older number stays).',
    flavor: '"Viktor has studied the numbers. Viktor believes the mine is on f5. Viktor sends a pawn to check."',
  },
  {
    id: 'MOD-A015',
    name: 'The Roomba',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Wandering Hazard · Every Round',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'shared',
    description:
      'A robot vacuum travels clockwise around the outer ring of the board, one square per round. When it reaches a piece, it pushes that piece one square inward if that square is empty. Otherwise it waits.',
    prototypeRules:
      'The Roomba starts on a4 or h5 (picked with the game seed) and goes clockwise round the outer ring as White sees it, one square after every round (once Black has moved). It never blocks a piece and cannot be taken. When the next square holds a piece, it pushes that piece one square towards the centre (diagonally from a corner) and moves on. If that square is not empty and real, or the push would put a King in check or add a checker, it waits. It also waits before a wall, flock, statue or storm square, so it parks once the storm takes the edge. A hidden piece it bumps is revealed. Whenever a pawn is pushed, en passant is off for that turn.',
    flavor: '"It has bumped into Viktor\'s rook four times. It will bump into it again. It has no other plans."',
  },
  {
    id: 'MOD-A016',
    name: 'Monument To Gerald',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Obstacle · Pushable',
    cost: 1,
    curseLevel: 0,
    tier: 'B',
    scope: 'shared',
    description:
      'A statue of Gerald stands on e4 (d4, e5 or d5 if e4 is taken at the start). Nothing can land on it or pass through it. A piece moving into it from an adjacent square pushes it one square the same way, if that square is empty. The push is the whole move.',
    flavor: '"They built him a statue. Gerald has been sitting on it since the ribbon was cut."',
    prototypeRules:
      'A statue of Gerald stands on e4 (d4, e5 or d5 if e4 is taken at the start). Nothing can land on it or pass through it, and it blocks lines of check. A piece that could step onto it from a neighbouring square (King, Queen, Rook, Bishop and their cousins along their lines; a pawn only straight ahead) pushes it one square the same way instead, if that square is empty and not Lava or storm. The piece stays where it is; the push is the whole move. Knights and other leapers cannot push it. It cannot be captured. The storm swallows it, and Gravity cannot move it.',
  },
  {
    id: 'MOD-A017',
    name: 'Tide Goes In, Tide Goes Out',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Water · Cycle',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    scope: 'shared',
    description:
      'Every 8 rounds the tide comes in and ranks 4 and 5 become water for 4 rounds. Pieces may cross water but only knights and Kings may stop on it. A piece already on water when the tide arrives may only move off it. A warning shows the round before.',
    prototypeRules:
      'Ranks 4 and 5 are water on rounds 9 to 12, 17 to 20, and so on (8 rounds apart, 4 rounds each), marked one round ahead. While flooded, only knights and Kings may end a move on water; any other piece may cross it, and a piece caught on it must move off it (a pawn whose every step lands on water waits). Water is not a wall: lines of check cross it. Abilities that act from a distance are not affected.',
    flavor: '"The tide came in. The tide went out. Viktor cannot explain that."',
  },
  {
    id: 'MOD-A018',
    name: 'Shake It Off',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Earthquake · Telegraphed',
    cost: 4,
    curseLevel: 2,
    tier: 'S',
    scope: 'shared',
    description:
      'Every 10 rounds an earthquake moves every non-King piece one square in a random direction, if that square is empty. Each piece shows its arrow one round ahead, so both players can prepare.',
    prototypeRules:
      'Every 10 rounds an earthquake moves every non-King piece one square. Each piece gets its own direction (picked with the game seed, never off the board) at the start of round 10, shown as an arrow on it for that round. The quake happens once Black has moved in round 10; extra turns never bring it early. A piece that moves to the edge during round 10 loses an arrow that would now point off the board. A piece moves only if that square is empty and real; it never captures, never puts a King in check and never adds a checker. A piece whose square is freed by another piece in the same quake follows it. Pieces that reach the board after the arrows are picked stay put. A pawn never lands on rank 1 or 8. A hidden piece that blocks a move is revealed, and arrows on hidden or fogged enemy pieces are not shown.',
    flavor: '"The ground is shaking. Viktor\'s pieces are shaking. The pigeons are dancing."',
  },
  {
    id: 'MOD-A019',
    name: 'Crop Circles',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Safe Zone · Temporary',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'shared',
    description:
      'Every 8 rounds a 3×3 crop circle appears on the middle ranks for 3 rounds. Pieces inside it cannot be captured. They can still move and capture out of it.',
    prototypeRules:
      'On rounds 9 to 11, 17 to 19, and so on (8 rounds apart, 3 rounds each) a 3×3 crop circle covers a block inside ranks 3 to 6, picked with the game seed and marked one round ahead. No move, ability, en passant or Berserker chain may capture a piece standing inside it. Pieces inside move and capture normally. Check is not affected: a King in the circle is in check as usual. The FOR THE EMPEROR cannonball flies over circle pieces.',
    flavor: '"Something made these patterns overnight. Viktor\'s bishop is inside one. It feels safe. It has not asked why."',
  },
  {
    id: 'MOD-A020',
    name: 'One Way Street',
    category: 'A',
    categoryName: 'Board Mutations',
    typeLine: 'Board Mutation · Direction · Permanent',
    cost: 2,
    curseLevel: 1,
    tier: 'B',
    scope: 'shared',
    description:
      'The c-file runs north only and the f-file runs south only. A piece moving along one of those files may only move in its arrow\'s direction. Crossing the file sideways is allowed.',
    prototypeRules:
      'A move that starts and ends on the c-file must go north (towards rank 8); one on the f-file must go south (towards rank 1). This includes pawns, so a black pawn on the c-file and a white pawn on the f-file cannot step forward (they can still capture). Crossing or leaving the file is allowed, and Kings ignore the signs. Like the move-rule curses, it never takes away the last legal move and does not apply in check. Abilities and Freaky Friday swaps are not limited; a Berserker chain capture is. Not in a match with Bandersnatch Protocol.',
    flavor: '"Viktor\'s rook wished to go home. The sign said no."',
  },

  // ── CATEGORY B — CURSED MODIFIERS ──────────────────────────────────────────

  {
    id: 'MOD-B001',
    name: 'YOU DIED (But A Piece Did)',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Autonomous Piece · High Madness',
    cost: -3,
    curseLevel: 3,
    tier: 'S',
    description:
      'Every 7th of your moves, one of YOUR pieces chooses its own legal move autonomously. You have no input. The piece has decided. It counts as your move. The screen briefly flashes "A PIECE MOVED" in large red letters.',
    flavor: '"A piece moved itself to h4. Viktor stared at the screen for a long time. The letters were not helpful."',
    prototypeRules:
      'Every 7th move of the owner is played for them: a random legal move, never one that leaves the king in check. It counts as their move. Abilities are never used.',
  },
  {
    id: 'MOD-B002',
    name: 'Distracted Piece',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Interference · Named NPC',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    description:
      'At the start of each turn, a pigeon named Gerald lands on one of your pieces, blocking it. Spend your turn clicking Gerald off — freeing the piece but forfeiting your move. Gerald maintains his own interference leaderboard.',
    flavor: '"Gerald is looking at something else entirely. Viktor\'s rook is right there. Gerald does not care."',
    prototypeRules:
      'Gerald holds a piece for 2 of your turns. Click him to shoo him off. That costs your turn and is not allowed in check. No leaderboard yet.',
  },
  {
    id: 'MOD-B003',
    name: 'No, I Don\'t Think I Will',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Directional Inversion · Time-Limited',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    description:
      'For the first 5 turns, all your pieces move in the opposite direction to your click. Left becomes right. Forward becomes backward. Legal rules still apply — just inversely. A banner displays "NO, I DON\'T THINK I WILL" at match start.',
    flavor: '"Viktor clicked forward. His pawn went backward, with the energy of someone who has made peace with their decision."',
    prototypeRules:
      'For your first 5 moves, your clicks are flipped across the centre of the board: to play e2 to e4 you click d5. Picking up a piece works as normal, and the highlighted squares show where to click. Moves are still normal legal moves.',
  },
  {
    id: 'MOD-B004',
    name: 'Heavy Is The Crown',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Piece Debuff · King Only',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    description:
      'Your King moves at half speed — a two-turn commitment. During the commitment window the destination is visible to your opponent. Castling takes 3 turns total.',
    flavor: '"The crown weighs heavily. The King moves slowly. Somewhere, someone is writing bars about this."',
    prototypeRules:
      'Your King moves in two steps. Select it and press Order move to pick a square (this costs your turn). On a later turn, move the King there. Your opponent sees the ordered square. In check, the King moves freely and the order is dropped. Castling also takes two turns.',
  },
  {
    id: 'MOD-B005',
    name: '50 First Moves',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Information Loss · Persistent',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    description:
      'Every 6 turns, the move history wipes and becomes unreadable for 3 turns. En passant cannot be claimed during a blackout. Opponent history is also hidden.',
    flavor: '"Viktor cannot remember what his opponent did three turns ago. He is framing this as a fresh start."',
    prototypeRules:
      'From move 6, and every 6 moves after, your move history is hidden for 3 moves, including the last-move highlight. You cannot take en passant during a blackout.',
  },
  {
    id: 'MOD-B006',
    name: 'They Were The Traitor',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Piece Defection · Random',
    cost: -3,
    curseLevel: 3,
    tier: 'S',
    description:
      'After turn 10, at a random point, one random non-King piece of yours defects to the opponent. You are warned 1 turn in advance. The ejection screen appears briefly.',
    flavor: '"Queen was The Traitor. 7 pieces remain. Viktor stares at the screen. Viktor voted wrong."',
    prototypeRules:
      'From move 11 on, each of your turns has a 1 in 4 chance to pick a traitor: a random non-king piece of yours (a pawn only if nothing else is left). It is marked with ! and defects at the start of your next turn. Trade it off first and the search starts again. Happens once per match.',
  },
  {
    id: 'MOD-B007',
    name: 'Conscientious Objector',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Piece Restriction · Selective',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    description:
      'One randomly selected pawn holds deeply personal convictions and will not capture. It moves, blocks, and promotes — but will not take a piece. If promoted to Queen, the Queen is also a pacifist.',
    flavor: '"The pawn has values. Viktor respects this. Viktor is also trying to win a chess match."',
    prototypeRules:
      'Plays as written.',
  },
  {
    id: 'MOD-B008',
    name: '7/10 — Too Many Pieces',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · UI Disruption · Commentary',
    cost: 0,
    curseLevel: 0,
    tier: 'B',
    description:
      'After every move you make, pigeon critic Reginald Beak appears with a 200ms review of your decision. Reginald has no gameplay effect. He has many opinions.',
    flavor: '"Reginald gave Viktor\'s en passant a 3/10. Viktor has given Reginald a 0/10. Reginald was unaffected."',
    prototypeRules:
      'Reginald reviews every move the owner makes in the match feed. About 30 review lines so far. No gameplay effect, so the card is free and adds no curse. It still uses a draft slot.',
  },

  // Design cards (not built yet): Cursed 009-020

  {
    id: 'MOD-B009',
    name: 'Speedrun Any%',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Move Timer · Pressure',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    scope: 'owned',
    description:
      'You have 15 seconds for each move. If the timer runs out, a random legal move is played for you. The timer pauses while any popup is open.',
    flavor: '"Viktor has never been rushed. Viktor is being rushed. Viktor finds it invigorating and upsetting."',
    prototypeRules:
      'You have 15 seconds for each move. A bar under the board counts down. If it runs out, a random legal move is played for you, picked with the game seed: never an ability and never one that leaves your King in check. The timer pauses while a popup is open and starts again from 15 at your next move. Not offered online, because online games have no clock.',
  },
  {
    id: 'MOD-B010',
    name: 'Main Character Syndrome',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Queen · Attention Seeking',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    scope: 'owned',
    description:
      'Your Queen must move at least once every 4 of your moves. If you skip her too long, your next move must be a Queen move if she has one.',
    flavor: '"The queen would like to remind everyone that this is her story."',
    prototypeRules:
      'After 3 of your moves in a row without a Queen move, your 4th move must be a Queen move (her ability counts, but not The Snap). The feed warns you a move ahead. If she has no legal move, or you are in check, any legal move is allowed and she stays owed. While she is owed and has a move, you cannot shoo Gerald. Once you have no Queen, the curse is over for good.',
  },
  {
    id: 'MOD-B011',
    name: 'Case Of The Mondays',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Slow Start · Time-Limited',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    scope: 'owned',
    description:
      'For your first 6 moves, none of your pieces may move more than 2 squares.',
    flavor: '"It is round one. Viktor\'s bishop has not had its coffee."',
    prototypeRules:
      'For your first 6 moves, no piece may move more than 2 squares in any direction. A knight jump and castling count as 2, so both are fine. Abilities are not limited. In check, or if no short move exists, any legal move is allowed. The feed says when Monday is over, at the start of your 7th move.',
  },
  {
    id: 'MOD-B012',
    name: 'Bless You',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Slider Debuff · Counter',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    scope: 'owned',
    description:
      'Every 8th move you make with a rook, bishop or queen, the piece sneezes and stops one square short. A counter on the piece shows when the next sneeze is due.',
    prototypeRules:
      'Your rook, bishop and queen moves are counted together. On the 8th, 16th, ... such move, a move of two or more squares along a line stops one square short, so it never captures. A one-square move, a knight-style Amazon move, or a stop that is not allowed (it would leave your King in check, or another card forbids that square) plays in full, and that sneeze is spent. Abilities do not count. Your rooks, bishops and queens show how many of these moves are left before the next sneeze.',
    flavor: '"The bishop sneezed. The bishop is very sorry. The bishop is one square short of where it meant to be."',
  },
  {
    id: 'MOD-B013',
    name: 'Death And Taxes',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Material Loss · Scheduled',
    cost: -3,
    curseLevel: 3,
    tier: 'S',
    scope: 'owned',
    description:
      'Every 10 of your moves, the tax office collects one of your pawns: the one furthest back. You are warned one move before. Once you have no pawns, the curse ends.',
    prototypeRules:
      'At the start of your 10th, 20th, 30th ... move the feed warns you and marks the pawn that would be taken. Right after that move, the tax office removes your rearmost pawn as the board then stands (on a tie, the one nearest the a-file). It never takes a pawn whose removal would leave your King in check; it takes the next one back instead. Once you have no pawns, nothing more is taken. If tax day is a pass or skipped turn, the tax is taken after your next real move. Pawns are what your opponent sees, so under Sus a piece disguised as a pawn is taxed like one and a disguised pawn is never taken. The warning is always posted on tax day while you have pawns, even when none can be taken yet. A taxed pawn cannot be taken en passant. Cannot be drafted with The Small Council.',
    flavor: '"Viktor has filed his return. The pawn has been seized. Viktor is told this is normal."',
  },
  {
    id: 'MOD-B014',
    name: 'Imposter Syndrome',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Queen · After Capture',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    scope: 'owned',
    description:
      'After your Queen captures, she doubts herself. Her next move can only be one square, like a King.',
    prototypeRules:
      'After your Queen captures, she doubts herself: her next move can only be one square, like a King. The doubt lasts until she moves, and she shows a \u2026 badge. Abilities that keep her in place do not count as her move. In check, she may move anywhere, and the rule never takes away your last move. A pawn that captures and promotes to a Queen does not doubt.',
    flavor: '"She took the rook. She is not sure she deserved to take the rook. She will take one small step now."',
  },
  {
    id: 'MOD-B015',
    name: 'Commitment Issues',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Touch-Move · Discipline',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    scope: 'owned',
    description:
      'Touch-move rules apply to you. Once you select a piece that has a legal move, you must move that piece.',
    flavor: '"Viktor touched the knight. The knight looked at him. They both knew what had to happen."',
    prototypeRules:
      'Tap a piece that can move and it is touched: you must move it this turn. It wears a T. It may move or use its ability. A piece with no legal move does not count. Bots do not touch. On phones, holding a square to read it never touches. You cannot shoo Gerald after a touch.',
  },
  {
    id: 'MOD-B016',
    name: 'Lunch Break',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Heavy Pieces · Scheduled',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    scope: 'owned',
    description:
      'Every 10 of your moves, your rooks and Queen go on lunch. On your next move they cannot move. A sign shows the round before.',
    flavor: '"The rooks have gone to lunch. They took the queen. They did not invite Viktor."',
    prototypeRules:
      'On your 11th, 21st, 31st move and so on, your rooks, Queen and Chancellor cannot move or use abilities, and you cannot castle. The feed puts up a sign at the start of the move before. In check, lunch is cancelled. If only rooks and Queen could move, lunch is waived.',
  },
  {
    id: 'MOD-B017',
    name: 'MINE!',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Seagull · Pawn Setback',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    scope: 'owned',
    description:
      'Every 8 of your moves, a seagull swoops in and carries your most advanced pawn one square back toward your side, if that square is empty.',
    prototypeRules:
      'Right after your 8th, 16th, 24th ... move, a seagull carries your most advanced pawn one square straight back toward your side. On a tie, the pawn nearest the a-file. Nothing happens if that square is taken, Lava, void (a wall, flock, storm or statue) or your back rank, or if the move would expose your King. A pawn carried back to its start rank may double-step again. If that move is a pass or skipped turn, the seagull comes right after your next real move instead. Pawns are what your opponent sees, so under Sus a fake pawn in the lead means no seagull and a disguised pawn is skipped. Cannot be drafted with The Small Council.',
    flavor: '"The seagull took the pawn. The seagull said mine. Viktor disagrees about whose it was."',
  },
  {
    id: 'MOD-B018',
    name: 'Rubber Banding',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Lag · Counter',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    scope: 'owned',
    description:
      'Every 7th move you make lags: the piece moves, then snaps back to where it started. The move still counts as your turn. A ping counter shows when the next lag is due.',
    flavor: '"Viktor moved the bishop. The bishop moved back. Viktor blames his internet. Viktor does not have internet."',
  },
  {
    id: 'MOD-B019',
    name: 'Peer Pressure',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Forced Capture · Pawns',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    scope: 'owned',
    description:
      'If one of your pawns can capture, you must make a pawn capture. Your opponent can use this to drag your pawns out of position.',
    flavor: '"All the other pawns were capturing. This pawn did not want to. This pawn captured."',
    prototypeRules:
      'If one of your pawns can make a legal capture, you must capture with a pawn. You choose which. No other move, ability or Gerald shoo is allowed. In check, any legal move is allowed.',
  },
  {
    id: 'MOD-B020',
    name: 'Roll For Initiative',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Dice · Every 4th Move',
    cost: -3,
    curseLevel: 3,
    tier: 'A',
    scope: 'owned',
    description:
      'On every 4th move you make, a die picks a piece type. You must move a piece of that type if you can. If you cannot, you choose freely.',
    flavor: '"The die says knight. Viktor wanted the queen. The die does not care what Viktor wanted."',
    prototypeRules:
      'On your 4th, 8th, 12th move and so on, a seeded die picks one piece type you still have (the King counts). That move must be made by a piece of that type, or its ability (sacrificing it with The Snap does not count). If none can move, or you are in check, any legal move is allowed. While the die binds you, you cannot shoo Gerald.',
  },

  // ── CATEGORY C — ACTIVE ABILITIES ──────────────────────────────────────────

  {
    id: 'MOD-C001',
    name: 'I Hereby Declare',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · King · Cooldown: 8 turns',
    cost: 4,
    curseLevel: 0,
    tier: 'S',
    description:
      'The King declares a No-Fly Zone on any one row or column. No opponent piece may cross that line for 3 turns. Pigeons are exempt — they cannot read executive orders.',
    flavor: '"The King has issued an executive order banning rooks from the d-file. Enforcement is ongoing."',
    prototypeRules:
      'Select your king and press the ability button, then click a square on his column or row. That line closes: for 3 of their turns, enemy pieces cannot land on it or move across it. Pieces can still attack across it. Then the king waits 8 of your turns.',
  },
  {
    id: 'MOD-C002',
    name: 'Forgive Me, For I Have Moved',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Bishop · Cooldown: 5 turns',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    description:
      'Target one opponent piece. For 2 turns, that piece must reveal its intended destination before moving — a ghost outline appears. The opponent commits 1 turn early.',
    flavor: '"The bishop leaned in. The rook confessed where it was planning to go. The bishop did not offer absolution."',
    prototypeRules:
      'Bishop ability, every 5 turns: pick an enemy piece (not the King) on the bishop\'s diagonal. For its side\'s next 2 turns, moving that piece takes two steps. The first move only declares the square and spends the turn, with a ghost outline there. Then it can only move to that square. In check it moves freely.',
  },
  {
    id: 'MOD-C003',
    name: 'Did I Do That? (Oops)',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Knight · Cooldown: 6 turns',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    description:
      'This turn, your Knight moves like a Rook — any distance horizontally or vertically. It can capture on this move. The Knight is fully aware this is illegal. It moves anyway.',
    flavor: '"The knight moved in a straight line. It looked around. Nobody stopped it. Viktor pretended this was planned."',
    prototypeRules:
      'Select a knight (or Pigeon, Camel or Nightrider) and press the ability button. It moves like a rook this turn and can capture. Then that knight waits 6 of your turns. Cannot start from the Swamp.',
  },
  {
    id: 'MOD-C004',
    name: 'Retaliatory Swipe',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Pawn · Cooldown: 4 turns',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'The selected pawn captures diagonally backwards this turn only. No promotion awarded for this capture. Each pawn tracks its own cooldown independently.',
    flavor: '"The pawn turned around. \'Look what you made me do,\' it communicated through chess movement."',
    prototypeRules:
      'Select a pawn and press the ability button. It captures one square diagonally backwards. No promotion. Then that pawn waits 4 of your turns.',
  },
  {
    id: 'MOD-C005',
    name: 'Quiet Quitting',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Queen · Cooldown: 10 turns',
    cost: 5,
    curseLevel: 0,
    tier: 'S',
    description:
      'The Queen refuses to move this turn. Instead, she establishes a 3×3 Zone of Control. Any opponent piece entering the zone is pushed back 1 square. Duration: 2 turns.',
    flavor: '"The queen established her zone and sat quietly within it. This turned out to be extremely effective."',
    prototypeRules:
      'Select the queen and press the ability button, then click the queen. She stays put. Enemy pieces cannot move into the 3x3 around her for 2 of their turns, and cannot capture her. The zone ends early if she moves. Then she waits 10 of your turns.',
  },
  {
    id: 'MOD-C006',
    name: 'FOR THE EMPEROR',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Rook · Cooldown: 7 turns',
    cost: 4,
    curseLevel: 1,
    tier: 'A',
    description:
      'The Rook fires a cannonball in a chosen direction (N/S/E/W) travelling the full board, capturing the first piece it hits regardless of colour. Yes — it can capture your own pieces.',
    flavor: '"The rook fired. Something was hit. Viktor is checking whether it was his. It was his."',
    prototypeRules:
      'Select a rook and press the ability button, then click the piece to hit. The rook stays put and destroys the first piece on its rank or file, either colour. Kings block the shot. Then that rook waits 7 of your turns.',
  },
  {
    id: 'MOD-C007',
    name: 'This Is Necessary (The Snap)',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Any Piece · Once per piece',
    cost: 4,
    curseLevel: 0,
    tier: 'A',
    description:
      'Sacrifice any non-King piece to gain a Tempo Token. Spend a Token to take an additional turn immediately. Max 2 Tokens held at once.',
    flavor: '"The knight volunteered. \'This is necessary,\' it communicated. The knight was not wrong."',
    prototypeRules:
      'Select any non-king piece and press Sacrifice. It leaves the board and you gain a tempo token (max 2). That costs your turn. Later, press Extra move under the board before a move: you move again right after. A move that gives check cannot use a token.',
  },
  {
    id: 'MOD-C008',
    name: 'I\'ve Been Waiting For This',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Pawn · Cooldown: 3 turns',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'En passant is no longer a one-turn window. Bank it. Store the capture for up to 3 turns. Execute it whenever the moment is right. One banked en passant per pawn.',
    flavor: '"The pawn remembered. The pawn waited three turns. The pawn struck. \'I\'ve been waiting for this.\'"',
    prototypeRules:
      'When an enemy pawn double-steps from its starting rank past your pawn, your pawn banks the en passant. For 3 of your turns, select it and press the ability button to take it, as long as both pawns stay put. Then that pawn waits 3 of your turns.',
  },

  // Active Abilities 009-020 (v0.4): C009, C010, C011 and C013 are built, the rest are design cards

  {
    id: 'MOD-C009',
    name: 'YEET',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Rook · Cooldown: 6 turns',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your rook shoves an adjacent enemy piece one square straight away from it, if that square is empty. The rook stays put. Uses your move.',
    prototypeRules:
      'Select a rook and press YEET, then tap an enemy piece straight next to it (not the King). That piece is shoved one square further along the same line, if that square is empty and on the board. Lava is allowed and burns it. A pawn is never shoved onto rank 1 or 8. The rook stays put. The shove may not leave your King in check, and under fog you can only shove what you see onto squares you see. Under Sus, the pawn rule follows what you see. A piece is never shoved into one of your own Quiet Quitting zones. A rook moved out of its corner loses castling on that side. Then the rook waits 6 of your moves.',
    flavor: '"The rook did not ask. The bishop is now somewhere else."',
  },
  {
    id: 'MOD-C010',
    name: 'Leap Of Faith',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Bishop · Cooldown: 5 turns',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your bishop jumps over the first piece on one of its diagonals and lands on the empty square right behind it. No capture. Uses your move. Then it waits 5 of your moves.',
    prototypeRules:
      'Ability on a bishop; it then waits 5 of your moves. On any diagonal, the bishop jumps the first piece of either colour and lands on the empty square right behind it. No capture. A leap that leaves your King in check is not allowed. Under fog, the whole path must be in view. A bishop slowed by infection cannot leap.',
    flavor: '"The bishop jumped. There was a haystack. There is always a haystack."',
  },
  {
    id: 'MOD-C011',
    name: 'GET OVER HERE!',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Queen · Cooldown: 8 turns',
    cost: 4,
    curseLevel: 0,
    tier: 'S',
    scope: 'owned',
    description:
      'Your Queen pulls the first enemy piece on one of her lines to the square next to her. Uses your move. The piece is not captured, but now it is very close.',
    prototypeRules:
      'Select your Queen and press Get over here, then tap the first enemy piece on one of her 8 lines (not the King, and not one already next to her). It is pulled to the square next to her on that line. Not onto Lava, and a pawn is never pulled onto rank 1 or 8 (under Sus this follows what you see). Void squares end a line. Under fog the whole line must be in view. A piece is never pulled into one of your own Quiet Quitting zones. A rook moved out of its corner loses castling on that side. The pull may not leave your King in check. Then the Queen waits 8 of your moves.',
    flavor: '"The queen threw a chain. Nobody knows where she got the chain."',
  },
  {
    id: 'MOD-C012',
    name: 'Freaky Friday',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Any Two · Cooldown: 7 turns',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Select a piece and press Swap, then pick a neighbouring piece of yours. The two swap places. Neither may be your King. Uses your move. Both pieces wait 7 of your turns.',
    prototypeRules:
      'Select one of your pieces (not the King) and press Swap, then pick one of your pieces on a neighbouring square, diagonals included. The two trade squares. Neither may be your King. A pawn may not land on rank 1 or 8, or back on its start rank. The swap may not leave your King in check, and a piece that cannot move (held by Gerald, stuck, frozen, confessing) cannot be swapped. Both pieces count as moved for Winter, the Swamp and infection. Then both pieces wait 7 of your turns.',
    flavor: '"The knight is the bishop now. The bishop is the knight. They are learning a lot about each other."',
  },
  {
    id: 'MOD-C013',
    name: 'Hold My Bread',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Pawn · Cooldown: 6 turns',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'A pawn guards an adjacent friendly piece. That piece cannot be captured during your opponent\'s next move. Uses your move.',
    prototypeRules:
      'Select a pawn and press Hold my bread, then tap one of your pieces on the 8 squares around it (not the King). During your opponent\'s next move that piece cannot be captured: not by a move, en passant, an ability or a chain capture. The shield ends after their first move, even with an extra move from The Snap. It shows a ◇ badge while guarded. The pawn stays put. Not allowed in check. Then the pawn waits 6 of your moves.',
    flavor: '"The pawn said hold my bread. The bishop held the bread. The bishop survived."',
  },
  {
    id: 'MOD-C014',
    name: 'Run, Forrest, Run',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · King · Cooldown: 10 turns',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Select your King and press Run. It runs two squares in a straight line, if both squares are empty and safe. Uses your move. Then your King waits 10 of your turns.',
    flavor: '"Viktor\'s king just felt like running."',
    prototypeRules:
      'Select your King and press Run. It moves two squares in any straight line (rank, file or diagonal), if both squares are empty. No capture. It may not run through an attacked square or end in check. It may run while in check if it ends out of check. A King slowed by infection cannot run. Then your King waits 10 of your turns. One side cannot draft it with Heavy Is The Crown.',
  },
  {
    id: 'MOD-C015',
    name: 'Ctrl+Z',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Undo · Once per match',
    cost: 4,
    curseLevel: 0,
    tier: 'S',
    scope: 'owned',
    description:
      'Once per match, before your move, undo the last round: your last move and your opponent\'s reply both go back. Then you move again.',
    flavor: '"Viktor pressed undo. The universe complied. The pigeons noticed."',
  },
  {
    id: 'MOD-C016',
    name: 'Bullet Time',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Knight · Cooldown: 8 turns',
    cost: 4,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your knight makes two jumps in one move. The first jump cannot capture. The second can.',
    flavor: '"Everything slowed down. The knight did not."',
  },
  {
    id: 'MOD-C017',
    name: 'Get Off My Lawn',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · King · Cooldown: 8 turns',
    cost: 3,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Select your King, press Get off my lawn, then tap the King. Every enemy pawn next to it is pushed one square back toward its own side, if that square is empty. Uses your move. Then your King waits 8 of your turns.',
    prototypeRules:
      'Select your King, press Get off my lawn, then tap the King. Every enemy pawn on the 8 squares around it moves one square straight back toward its own side, if that square is empty (not Lava or storm) and not the pawn\'s own back rank. Pawns that cannot move, or that you cannot see, stay. Only offered when at least one pawn would move. Allowed in check only if the push ends the check. Then your King waits 8 of your turns.',
    flavor: '"Viktor\'s king has asked the pawns to leave. The pawns have left. They will be back."',
  },
  {
    id: 'MOD-C018',
    name: 'Dirt Hut',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Rook · Cooldown: 6 turns',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your rook places a wall on an empty square next to it. Nothing can land on or cross the wall for 4 rounds. Uses your move.',
    prototypeRules:
      'Select a rook, press Build wall, then tap an empty square next to it (any of the 8). A dirt wall stands there for 4 rounds: no piece can land on it or slide through it, and it blocks check like Gerald\'s statue. Knights still jump over it. Not on Lava or storm squares. Uses your move, then that rook waits 6 of your turns. At most 2 of your walls at a time. A wall is never placed where it would take away the last legal move of either King.',
    flavor: '"Viktor built a wall. It is made of dirt. It is the best wall he has ever built."',
  },
  {
    id: 'MOD-C019',
    name: 'Everyone Has A Price',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Queen · Cooldown: 12 turns',
    cost: 5,
    curseLevel: 0,
    tier: 'S',
    scope: 'owned',
    description:
      'An enemy pawn next to your Queen accepts a bribe and joins your side. It must be on its own half of the board. Uses your move.',
    flavor: '"Viktor offered bread. The pawn accepted bread. Loyalty is a matter of bread."',
  },
  {
    id: 'MOD-C020',
    name: 'Gotta Go Fast',
    category: 'C',
    categoryName: 'Active Abilities',
    typeLine: 'Active Ability · Pawn · Cooldown: 4 turns',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Select a pawn and press Dash. It moves two squares forward from any rank, if both squares are empty. No capture. Then that pawn waits 4 of your turns.',
    flavor: '"The pawn has been told about promotion. The pawn is in a hurry."',
    prototypeRules:
      'Select a pawn and press Dash. It moves two squares straight ahead from any rank, if both squares are empty. No capture. A dash cannot reach the last rank, so it never promotes. No en passant can be taken against it. An infected pawn cannot dash. Then that pawn waits 4 of your turns.',
  },

  // ── CATEGORY D — FOG OF WAR ─────────────────────────────────────────────────

  {
    id: 'MOD-D001',
    name: 'It\'s Dark And I\'m Scared',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Radial Vision · Symmetric',
    cost: 4,
    curseLevel: 1,
    tier: 'S',
    description:
      'Both players can only see within 2 squares of their own pieces. The rest: black. Pigeon pieces are always visible — they have luminescent tail feathers.',
    flavor: '"Viktor can see two squares in any direction. The other sixty-one squares are a philosophical position."',
    prototypeRules:
      'Each player sees only within 2 squares of their own pieces. The rest of the board is dark, and enemy moves into the dark are not shown in the log. Pigeons are always visible. Bots play with the same fog, but always know where your King is.',
  },
  {
    id: 'MOD-D002',
    name: 'I\'m Literally Right Here',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Decoys · Symmetric',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    description:
      'Each player places 2 Ghost Pieces — decoys that look real to the opponent. Ghosts vanish if an opponent piece passes through their square. You see your own Ghosts clearly.',
    flavor: '"One of those bishops isn\'t real. The opponent is very confident about which one. The opponent is wrong."',
    prototypeRules:
      'You get 2 Ghost knights or bishops on your third rank. They look real to your opponent and move like their type, but they never capture and never give check. An enemy that captures a Ghost finds nothing there. You see your Ghosts faded.',
  },
  {
    id: 'MOD-D003',
    name: 'What\'s In The Cloud, Bro',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Temporary · Zone',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'Every 10 turns, and on each capture, a 2×2 smoke cloud appears for 3 turns. You see through your own smoke. Opponent does not. Pieces inside the cloud are invisible to them.',
    flavor: '"Something was captured in there. Viktor thinks it was his knight. Viktor is not sure anymore."',
    prototypeRules:
      'Every 10 rounds, and on each capture, a 2×2 smoke cloud appears for 3 rounds. A capture puts the cloud over the capture square. The side that made the cloud sees through it; the other side does not see pieces inside. Bots play with the same fog, but always know where your King is.',
  },
  {
    id: 'MOD-D004',
    name: 'Known Unknowns (The Rumsfeld)',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Asymmetric · Random',
    cost: 2,
    curseLevel: 1,
    tier: 'B',
    description:
      'Each player has a randomly assigned 2×2 Blind Spot they cannot see even if adjacent. Blind Spots differ per player and shift every 15 turns. Players see their Blind Spot outline but not the contents.',
    flavor: '"Viktor knows there is a 2×2 area he cannot see. Viktor knows that he does not know. Viktor is spiralling."',
    prototypeRules:
      'Each player has a 2×2 Blind Spot in the middle of the board, marked by a dashed outline. Enemy pieces inside it are hidden, and enemy moves into it are not shown in the log. The two spots never overlap and move every 15 rounds. Bots play with the same fog, but always know where your King is.',
  },
  {
    id: 'MOD-D005',
    name: 'Sus (One Of These Is Lying)',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Identity Corruption · Persistent',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    description:
      'One of your opponent\'s pieces is displayed to you as a different piece type. The piece moves like its true self, revealing identity through movement patterns. The disguise is permanent.',
    flavor: '"That pawn moved like a rook. Viktor voted it out. Viktor was wrong. Viktor always votes wrong."',
    prototypeRules:
      'One of your pieces (never the King) looks like a different piece to your opponent. It still moves like its true self, and the move log shows the fake piece. You see a "Sus" badge on it. The disguise ends when the piece is captured or promotes.',
  },
  {
    id: 'MOD-D006',
    name: 'Cat Mode (Night Vision)',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Counter-Fog · Combo Modifier',
    cost: 1,
    curseLevel: 0,
    tier: 'B',
    description:
      'Only useful alongside another Fog modifier. Extends visibility radius by 1 additional square beyond normal fog limits. Does nothing without an accompanying fog effect.',
    flavor: '"Viktor engaged Cat Mode. Viktor can see slightly more of the darkness. The darkness remains unimpressed."',
    prototypeRules:
      'You see 3 squares around your pieces in It\'s Dark And I\'m Scared instead of 2. The draft only offers Cat Mode once It\'s Dark And I\'m Scared is picked. It cannot see into a Blind Spot or smoke.',
  },
  {
    id: 'MOD-D007',
    name: 'Recalculating…',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Move Hint Corruption · Persistent',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    description:
      'When you select a piece, legal move highlights include 1–2 false squares. Attempting a false square triggers "RECALCULATING…" and wastes your selection. All actual legal moves are still highlighted.',
    flavor: '"Viktor selected his knight. The board suggested f9. Viktor tried f9. f9 does not exist. RECALCULATING."',
    prototypeRules:
      'When either player selects a piece, 1 or 2 fake move dots appear near it. Picking a fake one shows RECALCULATING… and you choose again. No move is lost. Real moves are always shown. Bots are not fooled.',
  },
  {
    id: 'MOD-D008',
    name: 'Big Beak Is Watching',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Surveillance · Shared Mechanic',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'One tile becomes the Surveillance Square — visible to both players as a golden eye. Any piece moving within 1 square of it is revealed to BOTH players for 3 turns regardless of fog.',
    flavor: '"There is a square that sees everything. Viktor is avoiding it. His opponent has noticed. The square has noted this also."',
    prototypeRules:
      'One square in the middle of the board is the Surveillance Square, a golden eye both players see. A piece that moves onto it or next to it is shown to both players for 3 rounds, even through fog. Without a fog card it only announces who it saw.',
  },

  // Design cards (not built yet): Fog of War 009-020

  {
    id: 'MOD-D009',
    name: 'Invisibility Cloak',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Hidden Piece · Timed',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'At match start, pick one of your non-King pieces. It is invisible to your opponent for the first 10 rounds, or until it captures or gives check.',
    flavor: '"Viktor\'s bishop is wearing a cloak. Viktor\'s opponent is very confused about the missing bishop."',
    prototypeRules:
      'At the start, one of your minor pieces (knight, bishop, rook or a fairy piece) is picked at random. Your opponent cannot see it for the first 10 rounds. It shows when it captures, gives check or promotes. An enemy move that runs into it shows it too, and that player moves again. You see a cloak badge on it.',
  },
  {
    id: 'MOD-D010',
    name: 'Night Shift',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Day and Night · Cycle',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    scope: 'shared',
    description:
      'Every 8 rounds night falls for 4 rounds. At night, each player sees only within 2 squares of their own pieces. The sky in the header shows the time of day.',
    prototypeRules:
      'Night falls on rounds 9 to 12, 17 to 20 and so on (once Black has moved in round 8, 16, ...), with dusk shown the round before. At night each side sees only within 2 squares of its own pieces, exactly like It\'s Dark And I\'m Scared: Pigeons stay visible, moves into the dark are hidden, bots play with the same fog, and online the server does not send pieces in the dark. Cat Mode sees 3 squares. The header shows the time of day.',
    flavor: '"It is night. The pigeons have gone to sleep. Viktor has not. Viktor cannot sleep during a match."',
  },
  {
    id: 'MOD-D011',
    name: 'Footprints',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Tracking · Combo Modifier',
    cost: 1,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'When an enemy piece moves out of your sight, it leaves footprints on the square it left for 2 rounds. Only offered once a fog card is in the draft.',
    flavor: '"Something walked through here. It had small feet. Viktor suspects a pawn."',
    prototypeRules:
      'When an enemy piece moves onto a square you cannot see, the square it left shows footprints to you for 2 rounds. They show even in the fog. Drops, shoves and pulls leave none. Only offered once a fog card is in the match.',
  },
  {
    id: 'MOD-D012',
    name: 'Flashlight',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Reveal · Cooldown: 4 turns',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Once every 4 of your moves, shine a light on any 3×3 area. You see through fog, smoke and blind spots there for 1 round. It does not use your move. Only offered once a fog card is in the draft.',
    flavor: '"Viktor shone the light. Something was there. It was a knight. It was so much worse than a knight."',
    prototypeRules:
      'Select your King and press Flashlight, then tap the middle of a 3×3 area. You see through every fog card there through your move and the opponent\'s reply. It does not use your move: you still move after. Then it waits 4 of your moves. Bots do not use it. Only offered once a fog card is in the match.',
  },
  {
    id: 'MOD-D013',
    name: 'Poker Face',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Information · Hidden Log · Persistent',
    cost: 1,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Your opponent\'s move log shows only the squares your pieces moved to, not which piece moved. Your captured-pieces tray is hidden from them.',
    flavor: '"Viktor\'s face reveals nothing. It never has. That is not the card. That is just Viktor."',
    prototypeRules:
      'Display only. Your opponent\'s move log and match feed show only the square each of your moves went to (and a check mark), never which piece moved or what it took. The board is unchanged.',
  },
  {
    id: 'MOD-D014',
    name: 'Shell Game',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Disguise · Until Moved',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your Queen and two of your pawns look like cups to your opponent. Each cup shows its true piece the first time it moves or is attacked.',
    flavor: '"Three cups. One queen. Viktor\'s opponent is watching very carefully. It will not help."',
    prototypeRules:
      'Your Queen and two random pieces from her rank look like cups to your opponent. A cup is lifted, with an event, the first time its piece moves (or is moved), gives check, or an enemy piece you can see attacks its square. You see a U badge on yours.',
  },
  {
    id: 'MOD-D015',
    name: 'Camouflage',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Stillness · Ambush',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Any of your non-King pieces that stays still for 4 of your moves blends in and turns invisible to your opponent. It reappears when it moves, gives check, or is touched by an enemy move.',
    flavor: '"The rook has been very still. The rook is part of the board now. The rook has achieved peace."',
    prototypeRules:
      'Any of your pieces except the King that stays on its square for 4 of your moves turns invisible to your opponent. It shows again when it moves, gives check, or an enemy move runs into it (that player moves again). Any reveal (also Big Beak, or blocking a check) resets it: it must stay still for 4 more of your moves. A piece that shields your King from a line attack never hides. You see a ○ badge on your hidden pieces.',
  },
  {
    id: 'MOD-D016',
    name: 'Jump Scare',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Blackout · Scheduled',
    cost: 2,
    curseLevel: 1,
    tier: 'B',
    scope: 'shared',
    description:
      'Every 10 rounds the lights go out for one round. Both players make one move with every piece hidden except their own King. A warning flickers the round before.',
    flavor: '"The lights went out. Viktor moved his knight from memory. The knight was not where Viktor remembered."',
  },
  {
    id: 'MOD-D017',
    name: 'Crystal Ball',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Information · Forecast · Combo Modifier',
    cost: 1,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'You see every timed event two rounds earlier than normal: lava moves, storm waves, gravity shifts, pigeon hops, earthquakes, tides and the like.',
    flavor: '"The ball shows lava. The ball always shows lava. This time it is right."',
    prototypeRules:
      'Squares where a timed board event (lava, storm, gravity, Pigeon hops, flocks, tide, crop circles) lands within the next 2 rounds wear a crystal ball mark for you. Hold a square to see which event and when. It shows what happens if nothing changes, so a move can change it. Only offered once a timed-event card is in the match.',
  },
  {
    id: 'MOD-D018',
    name: 'Tells',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Information · Ability Tracking · Persistent',
    cost: 1,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'You see a glow on every enemy piece whose ability is ready to use, and the number of turns left on the rest.',
    flavor: '"The rook twitched. Viktor knows what a twitching rook means."',
    prototypeRules:
      'Enemy pieces you can see that have an ability glow when it is ready, or show the turns left. A Sus piece shows the tell of the type you see. Only offered once your opponent has a card with an ability.',
  },
  {
    id: 'MOD-D019',
    name: 'Spoiler Alert',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Information · Commitment · Every Move',
    cost: 3,
    curseLevel: 1,
    tier: 'A',
    scope: 'shared',
    description:
      'After each move, the player must mark which piece they will move next. Both players see the mark. In check, the mark is cancelled.',
    flavor: '"Viktor has been told the ending. He is disappointed. He will still play the move."',
  },
  {
    id: 'MOD-D020',
    name: 'Masquerade',
    category: 'D',
    categoryName: 'Fog of War',
    typeLine: 'Fog of War · Masks · Memory',
    cost: 4,
    curseLevel: 2,
    tier: 'S',
    scope: 'shared',
    description:
      'For the first 6 rounds, every piece except the Kings wears the same mask, for both players. Pieces still move as themselves. Remember your setup.',
    flavor: '"Everyone is wearing a mask. Viktor is wearing a mask. Viktor\'s mask has a better jawline."',
  },

  // ── CATEGORY E — ASYMMETRIC ARMIES ─────────────────────────────────────────

  {
    id: 'MOD-E001',
    name: 'Hatoful Gambit',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · New Piece Type · Knight Replacement',
    cost: 5,
    curseLevel: 0,
    tier: 'S',
    description:
      'Replace both Knights with Pigeon pieces. Pigeons move like Knights but every 5 turns each Pigeon announces (1 turn in advance) where it will autonomously hop — and then hops there regardless of your wishes.',
    flavor: '"The pigeons have opinions about their positioning. Viktor is negotiating. The pigeons are not."',
    prototypeRules:
      'Your knights become Pigeons. They move like knights. Every 5 rounds each of your Pigeons picks a square and both players see it. One move later it hops there on its own and captures anything there. A hop never takes a king or leaves a king in check; if the square is no longer safe, the Pigeon stays put. Gerald will not sit on Pigeons. A Pigeon from Hatchery, or one that changed sides, hops only if its side has this card.',
  },
  {
    id: 'MOD-E002',
    name: 'The Small Council',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Pawn Army · High Count',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    description:
      'Replace Knights and Bishops with 4 extra Pawns — total: 12 Pawns, King, Queen, 2 Rooks. No Knights, no Bishops. The 12-pawn side starts one rank forward (Rank 3).',
    flavor: '"The pawns are singing. Viktor is uncomfortable with the energy this brings to an otherwise professional match."',
    prototypeRules:
      'The owner starts with 8 pawns on their third rank and 4 more behind them on b, c, f and g. Pawns on the third rank cannot double step.',
  },
  {
    id: 'MOD-E003',
    name: 'Yeah, There Are Three Of Them',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · King-Centric · Defensive',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    description:
      'No Queen. Instead: 2 additional Kings (Royal Guards). Guards can be checkmated and removed from play without ending the game. The real King must still be protected normally.',
    flavor: '"Three kings on the board. \'Yeah,\' Viktor said, \'there are three of them.\'"',
    prototypeRules:
      'Your queen becomes a Royal Guard and a second Guard stands on your third rank. Guards step one square like a king and never castle. They can be captured like any piece. Only the real king matters for check.',
  },
  {
    id: 'MOD-E004',
    name: 'Equivalent Exchange (The Chancellor)',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · New Piece Type · Compound Mover',
    cost: 5,
    curseLevel: 0,
    tier: 'S',
    description:
      'Replace one Rook with The Chancellor — combining Rook and Knight movement. Each turn choose: move like a Rook OR like a Knight. Not both.',
    flavor: '"The Chancellor can go anywhere. The Chancellor chose here. Viktor is now scared."',
    prototypeRules:
      'One random rook becomes The Chancellor. It moves like a rook or a knight. That side loses castling on the Chancellor side.',
  },
  {
    id: 'MOD-E005',
    name: 'Twin Telepathy',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Linked Pieces · Symmetric Effect',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    description:
      'Both players\' Bishops are telepathically linked. When one Bishop moves, the other automatically mirrors the direction as far as legally possible. Applies to both players equally.',
    flavor: '"Viktor moved his bishop. His other bishop also moved. They did this without communicating. The bishops find it natural."',
    prototypeRules:
      'When a bishop moves, its twin of the same colour slides the same way up to the same distance. It stops before any piece, never captures, and stays put if blocked by another modifier or if the slide would expose its king.',
  },
  {
    id: 'MOD-E006',
    name: 'BOY. (The Berserker)',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Capture Chain · Aggressive',
    cost: 4,
    curseLevel: 0,
    tier: 'A',
    description:
      'One designated non-King piece is The Berserker. Whenever it captures, it may immediately chain-capture if another legal capture exists — and keep going. If captured, its title passes to a random surviving piece.',
    flavor: '"The rook captured once. Then again. Then a third time. \'BOY.\' said the rook, to nobody in particular."',
    prototypeRules:
      'The game picks the Berserker (never a king or pawn). After it captures, it automatically takes one more capture if there is one, never more. It skips any capture that would leave its king in check.',
  },
  {
    id: 'MOD-E007',
    name: 'Reject Queen, Embrace Knight',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Promotion Rule · Strategic',
    cost: 2,
    curseLevel: 1,
    tier: 'B',
    description:
      'Your pawns cannot promote to Queen. Knight, Bishop, or Rook only. However, any promoted piece gains chain-capture for their first capture after promotion.',
    flavor: '"It became a knight. Everyone in the room was surprised. The knight had been training."',
    prototypeRules:
      'Your pawns promote to a knight, bishop or rook only. The promoted piece chains one extra capture on its first capture after promotion.',
  },
  {
    id: 'MOD-E008',
    name: 'Moneyball (We\'ll Buy Them Back)',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Captured Piece Reuse · Economy',
    cost: 4,
    curseLevel: 0,
    tier: 'A',
    description:
      'Each piece you lose generates a Mercenary Token. Spend a Token (costs your turn) to drop a captured piece onto an empty square in your first three ranks. Cannot drop to give check. Max 1 Token held.',
    flavor: '"Viktor lost a bishop. Viktor ran the numbers. Viktor bought the bishop back at a discount."',
    prototypeRules:
      'Each of your pieces captured earns a Mercenary Token (max 1). Select your King and press Buy back to spend it: pick a lost piece and drop it on an empty square in your first three ranks. It costs your turn. A drop may not give check, and pawns may not drop on rank 1 or 8.',
  },

  // Asymmetric Armies 009-020: designs, except cards that have prototypeRules (built)

  {
    id: 'MOD-E009',
    name: 'Slay Queen (The Amazon)',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Compound Mover · Queen',
    cost: 5,
    curseLevel: 0,
    tier: 'S',
    scope: 'owned',
    description:
      'Your Queen can also move like a knight.',
    flavor: '"She can go anywhere. She has decided to go everywhere."',
    prototypeRules:
      'Your starting Queen also moves like a knight. A queen you promote later is a normal queen. Cannot be drafted with Yeah, There Are Three Of Them.',
  },
  {
    id: 'MOD-E010',
    name: 'Holy Knight (The Archbishop)',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Compound Mover · Bishop Replacement',
    cost: 4,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'One of your bishops becomes an Archbishop. Each move, it moves like a bishop or like a knight.',
    flavor: '"The bishop prayed for more options. The prayer was answered. The answer had a horse in it."',
    prototypeRules:
      'One of your bishops, picked at random, becomes an Archbishop. It moves like a bishop or a knight. Cannot be drafted with The Small Council.',
  },
  {
    id: 'MOD-E011',
    name: 'Lawrence Of Arabia',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · New Piece Type · Knight Replacement',
    cost: 1,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Your knights become Camels. A Camel leaps three squares one way and one square the other, jumping over pieces.',
    flavor: '"The camel has crossed the desert. The desert was the queenside. Nobody was ready."',
    prototypeRules:
      'Your starting knights become Camels. A Camel leaps 3 squares one way and 1 the other, over pieces. It stays on one square colour. A knight you promote to later is a normal knight. Cannot be drafted with Hatoful Gambit, The Small Council or Knight Rider.',
  },
  {
    id: 'MOD-E012',
    name: 'Hopscotch',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · New Piece Type · Rook Replacement',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'One of your rooks becomes a Grasshopper. It moves along any queen line but must hop over exactly one piece and land on the square right behind it, capturing an enemy there. That side loses castling on the Grasshopper side.',
    flavor: '"It needs something to jump over. It is always looking for something to jump over. It is exhausting."',
    prototypeRules:
      'One random rook becomes a Grasshopper. Along any queen line it hops the first piece of either colour and lands on the square right behind it, capturing an enemy there. With nothing to hop, it cannot move that way. It gives check the same way. That side loses castling on the Grasshopper side. Under fog, a hop needs its whole path in view.',
  },
  {
    id: 'MOD-E013',
    name: 'Overseas Hire (The Cannon)',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · New Piece Type · Rook Replacement',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'One of your rooks becomes a Cannon. It moves like a rook, but captures only by jumping over exactly one piece on its line to take the next one. That side loses castling on the Cannon side.',
    flavor: '"The cannon arrived from abroad. It brought its own rules. It is very proud of them."',
    prototypeRules:
      'One random rook becomes a Cannon. It slides like a rook onto empty squares. It captures only by jumping over exactly one piece of either colour on its line and taking the next piece behind it. It gives check the same way, only through a screen. That side loses castling on the Cannon side. Under fog, a capture needs its whole path in view.',
  },
  {
    id: 'MOD-E014',
    name: 'Crab Rave',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Pawn Rule · Movement',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your pawns can also step one square sideways onto an empty square. They still capture only diagonally forward.',
    flavor: '"The pawns have learned to walk sideways. The pawns will not stop walking sideways."',
    prototypeRules:
      'Your pawns can also step one square left or right onto an empty square. They still capture only diagonally forward. A sideways step never captures or promotes, is never en passant, gives no en passant, and does not reset the 50-move count.',
  },
  {
    id: 'MOD-E015',
    name: 'Stonks',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Trade · Setup',
    cost: 3,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Start the match with two fewer pawns (the a- and h-pawns) and an extra knight on b3.',
    flavor: '"Viktor sold two pawns. Viktor bought a horse. The market reacted."',
    prototypeRules:
      'You start without your a- and h-pawns, and with an extra knight on b3 (b6 for Black). With Hatoful Gambit, Lawrence Of Arabia or Knight Rider the new knight changes too. Cannot be drafted with The Small Council.',
  },
  {
    id: 'MOD-E016',
    name: 'Hatchery',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Egg · Delayed Piece',
    cost: 4,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'A pigeon Egg sits on your d3 square. It cannot move. If it survives 10 rounds, it hatches into a Pigeon, which moves like a knight.',
    flavor: '"Viktor is guarding an egg. The egg is the most important piece on the board. The egg disagrees."',
    prototypeRules:
      'An Egg sits on your d3 (d6 for Black), or the nearest empty square on that rank. It never moves and gives no check, but it blocks and can be captured. After 10 of your moves it hatches into a Pigeon that moves like a knight. The Egg shows the moves left. Cannot be drafted with The Small Council.',
  },
  {
    id: 'MOD-E017',
    name: 'The Bodyguard',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · New Piece · King-Centric',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'A Bodyguard replaces your g-pawn. It moves like a King. As its move, it may swap places with your King if they are next to each other.',
    prototypeRules:
      'Your g-pawn starts as a Bodyguard. It steps one square like a King, can be captured and never castles. As its move it may swap places with your King when they stand next to each other. The swap counts as a King move: castling is lost, and it may not leave your King in check. A swap out of check is allowed if it ends the check. The King must be free to move: a frozen or confessed King cannot swap. Cannot be drafted with The Small Council or Heavy Is The Crown.',
    flavor: '"He will take the check for the King. He has said this many times. Nobody asked."',
  },
  {
    id: 'MOD-E018',
    name: 'Zerg Rush',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Pawn Rule · Aggressive',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your pawns may move two squares forward from any rank, if both squares are empty. They capture normally.',
    flavor: '"The pawns are coming. All of them. Right now."',
    prototypeRules:
      'Your pawns may move two squares straight ahead from any rank, if both squares are empty. A two-square move may reach the last rank and promote. They capture normally. Only a two-square move from the starting rank can be taken en passant.',
  },
  {
    id: 'MOD-E019',
    name: 'Knight Rider',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Rider · Knights',
    cost: 4,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'Your knights may repeat the same L-jump in a straight line, as long as each landing square is empty, stopping on or capturing at the last.',
    flavor: '"The knight has a talking car. The knight will not stop talking about the talking car."',
    prototypeRules:
      'Your starting knights become Nightriders. A Nightrider repeats one knight jump in a straight line while each landing square is empty, and stops on or captures at the last. One jump is a normal knight move. Cannot be drafted with Hatoful Gambit, The Small Council or Lawrence Of Arabia.',
  },
  {
    id: 'MOD-E020',
    name: 'Elephant In The Room',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Downgrade · Bishop Replacement',
    cost: -3,
    curseLevel: 1,
    tier: 'B',
    scope: 'owned',
    description:
      'Your bishops become Elephants. An Elephant moves one or two squares diagonally, jumping over the square between.',
    flavor: '"Nobody is talking about the elephants. The elephants are fine with this."',
    prototypeRules:
      'Your starting bishops become Elephants. An Elephant moves 1 or 2 squares diagonally; the 2-square move jumps the square between. A bishop you promote to later is a normal bishop. Cannot be drafted with Holy Knight, The Small Council or Forgive Me.',
  },
];
