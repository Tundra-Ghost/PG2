import type { Color, GameState } from '../engine/types';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove, getPigeonBotMove } from '../engine/bot';
import { getDraftScope } from '../modifiers/scope';

/**
 * Bible balance test plan: bot-vs-bot games with one card on one side, so
 * each card's win rate can be compared with plain chess. Run it with
 * `pnpm --filter @pigeon-chess/game-core balance`.
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
}

export interface GameResult {
  winner: Color | null;
  plies: number;
  /** Turns passed or spent shooing Gerald because no move was found. */
  skipped: number;
  /** Hit maxPlies without an end. */
  capped: boolean;
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
  { maxPlies = 160, bot = 'pigeon', depth = 1 }: BalanceOptions = {},
): GameResult {
  let state = chessEngine.getInitialState();
  state.prngSeed = seed;
  state.prngState = seed;
  state = chessEngine.activateDraftModifiers(state, cardIds.map(id => ({ id, sourceColor: cardSide })));
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
  return { winner, plies: state.moveHistory.length, skipped, capped: state.status === 'active' };
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
  const { games = 20, maxPlies = 160, bot = 'pigeon', depth = 1, seed = 1 } = options;
  const pct = (n: number | null) => (n === null ? 'n/a' : `${Math.round(n * 100)}%`);
  const lines = [
    `Bot: ${bot}${bot === 'pigeon' ? ` depth ${depth}` : ''}. ${games} games per card, card side alternating. Cap ${maxPlies} moves (counts as a draw). Seed ${seed}.`,
    '',
    '| Card | Name | Scope | Win rate | W | L | D | Capped | Skipped turns | Avg moves | Flag |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    lines.push(
      `| ${r.id} | ${names.get(r.id) ?? ''} | ${r.id === 'plain chess' ? '' : r.shared ? 'Shared' : 'Owner'} | ${pct(r.winRate)} | ${r.wins} | ${r.losses} | ${r.draws} | ${r.capped} | ${r.skipped} | ${r.avgPlies} | ${isFlagged(r) ? 'outside 40-60%' : ''} |`,
    );
  }
  return lines.join('\n');
}
