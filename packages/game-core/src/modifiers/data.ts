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
      'A new Infected tile appears every 5 rounds. Each round, every Infected tile has a 25% chance to spread to a neighbour. Rooks, bishops and queens standing still on infection lose 1 square of reach per round. Pawns lose their double step. Knights and kings are not slowed. A bishop or queen clears every square it crosses. Lava burns infection away.',
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
      'The four central squares (d4, d5, e4, e5) are the Swamp. Any piece in the Swamp moves at 1 square per turn. Knights are trapped for 2 turns upon entering.',
    flavor: '"Viktor entered the Swamp to seize the centre. The Swamp seized Viktor. They are negotiating terms."',
    prototypeRules:
      'A piece that starts its move in the Swamp moves only 1 square, captures included. Pieces may still slide through. A knight that lands in the Swamp is stuck for 2 turns, then leaps out normally. Swamp pieces still give check at full range.',
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
      'A statue of Gerald stands on e4. Nothing can land on it or pass through it. A piece moving into it from an adjacent square pushes it one square the same way, if that square is empty. The push is the whole move.',
    flavor: '"They built him a statue. Gerald has been sitting on it since the ribbon was cut."',
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
      'Every 8 rounds the tide comes in and ranks 4 and 5 become water for 4 rounds. Pieces may cross water but only knights may stop on it. A piece already on water when the tide arrives may only move off it. A warning shows the round before.',
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
      'Every 7 turns, one of YOUR pieces chooses its own legal move autonomously. You have no input. The piece has decided. It counts as your turn. The screen briefly flashes "A PIECE MOVED" in large red letters.',
    flavor: '"A piece moved itself to h4. Viktor stared at the screen for a long time. The letters were not helpful."',
    prototypeRules:
      'Every 7th turn of the owner is played for them: a random legal move, never one that leaves the king in check. It counts as the turn. Abilities are never used.',
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
      'After turn 10, at a random point, one of your non-King pieces defects to the opponent — weighted toward your highest-value piece. You are warned 1 turn in advance. The ejection screen appears briefly.',
    flavor: '"Queen was The Traitor. 7 pieces remain. Viktor stares at the screen. Viktor voted wrong."',
    prototypeRules:
      'From move 11 on, each of your turns has a 1 in 4 chance to pick a traitor: your most valuable non-king piece. It is marked with ! and defects at the start of your next turn. Trade it off first and the search starts again. Happens once per match.',
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
  },
  {
    id: 'MOD-B020',
    name: 'Roll For Initiative',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · Dice · Every 3rd Move',
    cost: -2,
    curseLevel: 2,
    tier: 'A',
    scope: 'owned',
    description:
      'On every 3rd move you make, a die picks a piece type. You must move a piece of that type if you can. If you cannot, you choose freely.',
    flavor: '"The die says knight. Viktor wanted the queen. The die does not care what Viktor wanted."',
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
      'Select a knight and press the ability button. It moves like a rook this turn and can capture. Then that knight waits 6 of your turns. Cannot start from the Swamp.',
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
      'When an enemy pawn double-steps past your pawn, your pawn banks the en passant. For 3 of your turns, select it and press the ability button to take it, as long as both pawns stay put. Then that pawn waits 3 of your turns.',
  },

  // Design cards (not built yet): Active Abilities 009-020

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
      'Your bishop jumps over the first piece on one of its diagonals and lands on the empty square right behind it. No capture. Uses your move.',
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
      'Two of your adjacent pieces swap places. Neither may be your King. Uses your move.',
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
      'Your King runs two squares in a straight line, if both squares are empty and safe. Uses your move.',
    flavor: '"Viktor\'s king just felt like running."',
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
      'Every enemy pawn next to your King is pushed one square back toward its own side, if that square is empty. Uses your move.',
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
      'A pawn moves two squares forward from any rank, if both squares are empty. No capture.',
    flavor: '"The pawn has been told about promotion. The pawn is in a hurry."',
    prototypeRules:
      'Select a pawn and press Dash. It moves two squares straight ahead from any rank, if both squares are empty. No capture. A dash cannot reach the last rank, so it never promotes. No en passant can be taken against it. Then that pawn waits 4 of your turns.',
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
      'Your knights become Pigeons. They move like knights. Every 5 rounds each Pigeon picks a square and both players see it. One move later it hops there on its own and captures anything there. A hop never takes a king or leaves a king in check; if the square is no longer safe, the Pigeon stays put. Gerald will not sit on Pigeons.',
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
      'Each piece you lose generates a Mercenary Token. Spend a Token (costs your turn) to drop a captured piece onto any empty square as your own. Cannot drop to give check. Max 3 Tokens held.',
    flavor: '"Viktor lost a bishop. Viktor ran the numbers. Viktor bought the bishop back at a discount."',
    prototypeRules:
      'Each of your pieces captured earns a Mercenary Token (max 3). Select your King and press Buy back to spend one: pick a lost piece and drop it on any empty square. It costs your turn. A drop may not give check, and pawns may not drop on rank 1 or 8.',
  },

  // Design cards (not built yet): Asymmetric Armies 009-020

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
      'One of your rooks becomes a Grasshopper. It moves along any queen line but must hop over exactly one piece and land on the square right behind it, capturing anything there.',
    flavor: '"It needs something to jump over. It is always looking for something to jump over. It is exhausting."',
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
      'One of your rooks becomes a Cannon. It moves like a rook, but captures only by jumping over exactly one piece on its line to take the next one.',
    flavor: '"The cannon arrived from abroad. It brought its own rules. It is very proud of them."',
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
  },
  {
    id: 'MOD-E015',
    name: 'Stonks',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Trade · Setup',
    cost: 2,
    curseLevel: 0,
    tier: 'B',
    scope: 'owned',
    description:
      'Start the match with two fewer pawns (the a- and h-pawns) and an extra knight on b3.',
    flavor: '"Viktor sold two pawns. Viktor bought a horse. The market reacted."',
  },
  {
    id: 'MOD-E016',
    name: 'Hatchery',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Egg · Delayed Piece',
    cost: 3,
    curseLevel: 0,
    tier: 'A',
    scope: 'owned',
    description:
      'A pigeon Egg sits on your d3 square. It cannot move. If it survives 10 rounds, it hatches into a Pigeon, which moves like a knight.',
    flavor: '"Viktor is guarding an egg. The egg is the most important piece on the board. The egg disagrees."',
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
  },
  {
    id: 'MOD-E020',
    name: 'Elephant In The Room',
    category: 'E',
    categoryName: 'Asymmetric Armies',
    typeLine: 'Asymmetric · Downgrade · Bishop Replacement',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    scope: 'owned',
    description:
      'Your bishops become Elephants. An Elephant moves exactly two squares diagonally, jumping over the square between.',
    flavor: '"Nobody is talking about the elephants. The elephants are fine with this."',
  },
];
