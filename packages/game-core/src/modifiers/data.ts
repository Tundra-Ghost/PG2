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
  },
  {
    id: 'MOD-B008',
    name: '7/10 — Too Many Pieces',
    category: 'B',
    categoryName: 'Cursed',
    typeLine: 'Curse · UI Disruption · Commentary',
    cost: -1,
    curseLevel: 1,
    tier: 'B',
    description:
      'After every move you make, pigeon critic Reginald Beak appears with a 200ms review of your decision. Reginald has no gameplay effect. He has many opinions.',
    flavor: '"Reginald gave Viktor\'s en passant a 3/10. Viktor has given Reginald a 0/10. Reginald was unaffected."',
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
  },
];
