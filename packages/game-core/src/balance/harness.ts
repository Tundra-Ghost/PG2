import type { Color, GameState, Square } from '../engine/types';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove, getPigeonBotMove } from '../engine/bot';
import { positionKey } from '../engine/gameLoop';
import { ALL_MODIFIERS } from '../modifiers/data';
import { getDraftScope } from '../modifiers/scope';

/**
 * Bible balance test plan: bot-vs-bot games with one card on one side, so
 * each card's win rate can be compared with plain chess. Run it with
 * `pnpm --filter @pigeon-chess/game-core balance`.
 *
 * Cost-aware: in a real draft a card's cost is budget the drafter cannot
 * spend elsewhere. So each game compensates for it with material at
 * 1 point = 1 pawn (the Bible's curse pricing rates a lost piece, about
 * 3 to 4 pawns, at 3 points):
 * - a card with cost c > 0 gives the other side c extra pawns;
 * - a curse with cost -c gives the card side c extra pawns.
 * Extra pawns go on edge squares that block no piece's first moves:
 * a3, h3, b3, g3, then a4, h4 (mirrored for Black), skipping taken, void
 * and vent squares. Half points round up. A fairly priced card lands near
 * 50%. Shared cards get no compensation: they change the game for both
 * sides alike, so their price is not an edge for the drafter, and a pawn
 * handicap would be all the row measured.
 */

export type BalanceBot = 'chick' | 'pigeon';

export interface BalanceOptions {
  /** Games per card. The card side alternates between White and Black. */
  games?: number;
  /** A game still going after this many moves counts as a draw. */
  maxPlies?: number;
  bot?: BalanceBot;
  /** Pigeon search depth. 1 keeps a full run fast. */
  depth?: number;
  /** First game seed. Game n uses seed + n, so runs repeat exactly. */
  seed?: number;
  /** Compensate for card costs with pawns (see above). Default true. */
  costAware?: boolean;
}

export interface GameResult {
  winner: Color | null;
  plies: number;
  /** Turns passed or spent shooing Gerald because no move was found. */
  skipped: number;
  /** Hit maxPlies without an end. */
  capped: boolean;
  /** Compensation pawns put on the board. */
  extraPawns: number;
  /** Compensation pawns that found no free square. */
  missingPawns: number;
}

export interface CardResult {
  id: string;
  shared: boolean;
  games: number;
  /** Wins for the side that drafted the card. */
  wins: number;
  losses: number;
  draws: number;
  capped: number;
  skipped: number;
  avgPlies: number;
  /** wins / (wins + losses), or null when every game was drawn. */
  winRate: number | null;
  /** Card cost from the catalog (0 when unknown or plain chess). */
  cost: number;
  /** Compensation pawns per game (0 for shared cards). */
  compPawns: number;
  /** Compensation pawns that found no free square, summed over games. */
  missingPawns: number;
}

/** Catalog cost of a card, 0 when it has none. */
export function cardCost(id: string): number {
  return ALL_MODIFIERS.find(card => card.id === id)?.cost ?? 0;
}

/** Compensation squares for White, in order. Black uses the mirrored ranks. */
const COMPENSATION_SQUARES = ['a3', 'h3', 'b3', 'g3', 'a4', 'h4'] as const;

/** Adds `count` extra pawns for `color` on edge squares. Returns how many fit. */
export function addCompensationPawns(state: GameState, color: Color, count: number): number {
  let added = 0;
  for (const white of COMPENSATION_SQUARES) {
    if (added >= count) break;
    const square = (color === 'white' ? white : `${white[0]}${9 - Number(white[1])}`) as Square;
    const tile = state.tiles.get(square);
    if (state.pieces.has(square) || tile?.isVoid || tile?.statue || tile?.isVent) continue;
    state.pieces.set(square, { id: `balance-pawn-${color}-${square}`, type: 'pawn', color, square, cooldowns: {} });
    added++;
  }
  return added;
}

/** Which side gets how many compensation pawns for these cards. */
export function compensation(cardIds: string[], cardSide: Color): { color: Color; pawns: number } | null {
  const total = cardIds.filter(id => getDraftScope(id) !== 'shared').reduce((sum, id) => sum + cardCost(id), 0);
  if (total === 0) return null;
  const other: Color = cardSide === 'white' ? 'black' : 'white';
  return { color: total > 0 ? other : cardSide, pawns: Math.ceil(Math.abs(total)) };
}

function botMove(state: GameState, bot: BalanceBot, depth: number) {
  const color = state.turn;
  return bot === 'pigeon'
    ? getPigeonBotMove(state, color, { depth, timeBudgetMs: Infinity })
    : getChickBotMove(state, color);
}

/** Plays one bot-vs-bot game. `cardIds` are drafted by `cardSide`. */
export function playBalanceGame(
  cardIds: string[],
  cardSide: Color,
  seed: number,
  { maxPlies = 160, bot = 'pigeon', depth = 1, costAware = true }: BalanceOptions = {},
): GameResult {
  let state = chessEngine.getInitialState();
  state.prngSeed = seed;
  state.prngState = seed;
  state = chessEngine.activateDraftModifiers(state, cardIds.map(id => ({ id, sourceColor: cardSide })));
  const comp = costAware ? compensation(cardIds, cardSide) : null;
  let missingPawns = 0;
  let extraPawns = 0;
  if (comp) {
    extraPawns = addCompensationPawns(state, comp.color, comp.pawns);
    missingPawns = comp.pawns - extraPawns;
    if (extraPawns > 0) state.positionHistory = { [positionKey(state)]: 1 };
  }
  state = chessEngine.beginTurn(state);
  let skipped = 0;
  let steps = 0;
  while (state.status === 'active' && state.moveHistory.length < maxPlies && steps < maxPlies * 2) {
    steps++;
    const move = botMove(state, bot, depth);
    if (move) {
      state = chessEngine.applyMove(state, move);
    } else if (chessEngine.canShooGerald(state)) {
      state = chessEngine.shooGerald(state);
      skipped++;
    } else {
      state = chessEngine.passTurn(state);
      skipped++;
    }
  }
  const winner = state.status === 'checkmate' ? (state.turn === 'white' ? 'black' : 'white') : null;
  return { winner, plies: state.moveHistory.length, skipped, capped: state.status === 'active', extraPawns, missingPawns };
}

/** Plays `games` games with the card on alternating sides and sums them up. */
export function runCardBalance(id: string | null, options: BalanceOptions = {}): CardResult {
  const { games = 20, seed = 1 } = options;
  const result: CardResult = {
    id: id ?? 'plain chess',
    shared: id ? getDraftScope(id) === 'shared' : false,
    games,
    wins: 0,
    losses: 0,
    draws: 0,
    capped: 0,
    skipped: 0,
    avgPlies: 0,
    winRate: null,
    cost: id ? cardCost(id) : 0,
    compPawns: id ? compensation([id], 'white')?.pawns ?? 0 : 0,
    missingPawns: 0,
  };
  let plies = 0;
  for (let n = 0; n < games; n++) {
    const side: Color = n % 2 === 0 ? 'white' : 'black';
    const game = playBalanceGame(id ? [id] : [], side, seed + n, options);
    if (game.winner === side) result.wins++;
    else if (game.winner) result.losses++;
    else result.draws++;
    if (game.capped) result.capped++;
    result.skipped += game.skipped;
    result.missingPawns += game.missingPawns;
    plies += game.plies;
  }
  result.avgPlies = Math.round(plies / games);
  const decided = result.wins + result.losses;
  result.winRate = decided > 0 ? result.wins / decided : null;
  return result;
}

/** True when a card's win rate is outside the Bible's 40% to 60% band. */
export function isFlagged(result: CardResult): boolean {
  return result.winRate !== null && (result.winRate < 0.4 || result.winRate > 0.6);
}

/** A markdown table of results, flagged cards marked. */
export function formatBalanceReport(results: CardResult[], names: Map<string, string>, options: BalanceOptions = {}): string {
  const { games = 20, maxPlies = 160, bot = 'pigeon', depth = 1, seed = 1, costAware = true } = options;
  const pct = (n: number | null) => (n === null ? 'n/a' : `${Math.round(n * 100)}%`);
  const lines = [
    `Bot: ${bot}${bot === 'pigeon' ? ` depth ${depth}` : ''}. ${games} games per card, card side alternating. Cap ${maxPlies} moves (counts as a draw). Seed ${seed}.${costAware ? ' Cost-aware: 1 point = 1 extra pawn for the other side (or for a curse\'s owner); shared cards get none.' : ' No cost compensation.'}`,
    '',
    '| Card | Name | Scope | Cost | Extra pawns | Win rate | W | L | D | Capped | Skipped turns | Avg moves | Flag |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    lines.push(
      `| ${r.id} | ${names.get(r.id) ?? ''} | ${r.id === 'plain chess' ? '' : r.shared ? 'Shared' : 'Owner'} | ${r.id === 'plain chess' ? '' : r.cost} | ${r.compPawns ? `${r.compPawns}${r.missingPawns ? ` (${r.missingPawns} missing)` : ''}` : ''} | ${pct(r.winRate)} | ${r.wins} | ${r.losses} | ${r.draws} | ${r.capped} | ${r.skipped} | ${r.avgPlies} | ${isFlagged(r) ? 'outside 40-60%' : ''} |`,
    );
  }
  return lines.join('\n');
}
