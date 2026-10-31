/**
 * Puzzles (GDD §9): a position plus a modifier loadout and a goal.
 *
 * The solver is the side to move. The other side defends (in the web client,
 * a bot plays it). Everything here is pure so the server can check solutions
 * later without the client.
 */
import { chessEngine } from '../engine/ChessEngine';
import { positionKey } from '../engine/gameLoop';
import { isInCheck } from '../engine/moveGenerator';
import { getWinner } from '../engine/result';
import type { Color, GameState, Piece, PieceType, Square } from '../engine/types';
import { modifierRegistry } from '../modifiers/registry';
import { isSharedDraftModifier } from '../modifiers/scope';

export type PuzzleDifficulty = 'egg' | 'hatchling' | 'grandmaster';

export const PUZZLE_DIFFICULTIES: { id: PuzzleDifficulty; label: string }[] = [
  { id: 'egg', label: 'Egg' },
  { id: 'hatchling', label: 'Hatchling' },
  { id: 'grandmaster', label: 'Grandmaster' },
];

export type PuzzleGoal =
  /** Checkmate the defender within `moves` of the solver's moves. */
  | { type: 'checkmate'; moves: number }
  /** Remove the defender's piece on `target` within `moves` of the solver's moves. */
  | { type: 'capture'; target: Square; moves: number }
  /** Do not lose for `rounds` full rounds (a solver move plus a defender move). */
  | { type: 'survive'; rounds: number };

export interface PuzzlePiece {
  square: Square;
  type: PieceType;
  color: Color;
}

export interface PuzzleModifier {
  id: string;
  /** Who drafted it. Ignored (always null) for shared cards. */
  owner: Color | null;
}

export interface Puzzle {
  id: string;
  title: string;
  author: string;
  difficulty: PuzzleDifficulty;
  /** The solver. */
  toMove: Color;
  pieces: PuzzlePiece[];
  modifiers: PuzzleModifier[];
  goal: PuzzleGoal;
  /** Fixes every random modifier roll so a puzzle plays the same each time. */
  seed: number;
  /** Squares cut out of the board, so puzzles can use any board shape. */
  closed: Square[];
}

/** Pieces the editor can place. Modifier-only pieces come from the modifiers themselves. */
export const PUZZLE_PIECE_TYPES: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

export const MAX_PUZZLE_MOVES = 10;

const FILES = 'abcdefgh';

function otherColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export function isSquare(value: unknown): value is Square {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}

export function createEmptyPuzzle(id: string): Puzzle {
  return {
    id,
    title: 'Untitled puzzle',
    author: '',
    difficulty: 'egg',
    toMove: 'white',
    pieces: [
      { square: 'e1', type: 'king', color: 'white' },
      { square: 'e8', type: 'king', color: 'black' },
    ],
    modifiers: [],
    goal: { type: 'checkmate', moves: 1 },
    seed: 1,
    closed: [],
  };
}

/** Builds the position with no modifiers yet, so it can be checked as plain chess. */
function buildBareState(puzzle: Puzzle): GameState {
  const state = chessEngine.getInitialState();
  state.id = `puzzle-${puzzle.id}`;
  state.pieces = new Map();
  for (const [index, spec] of puzzle.pieces.entries()) {
    const piece: Piece = {
      id: `p${index}-${spec.color}-${spec.type}`,
      type: spec.type,
      color: spec.color,
      square: spec.square,
      cooldowns: {},
    };
    state.pieces.set(spec.square, piece);
  }
  state.tiles = new Map(
    puzzle.closed.map(square => [square, { square, effects: [], isVoid: true, isClosed: true }]),
  );
  state.turn = puzzle.toMove;
  state.prngSeed = puzzle.seed | 0;
  state.prngState = puzzle.seed | 0;

  // Castling is allowed only when king and rook still stand on their start
  // squares and the board shape leaves the squares between them.
  const closed = new Set<string>(puzzle.closed);
  const rowOpen = (files: string[], rank: string) => files.every(file => !closed.has(`${file}${rank}`));
  const at = (sq: string, type: PieceType, color: Color) => {
    const piece = state.pieces.get(sq as Square);
    return piece?.type === type && piece.color === color;
  };
  for (const color of ['white', 'black'] as const) {
    const rank = color === 'white' ? '1' : '8';
    const king = at(`e${rank}`, 'king', color);
    state.flags.castlingRights[color] = {
      kingSide: king && at(`h${rank}`, 'rook', color) && rowOpen(['f', 'g'], rank),
      queenSide: king && at(`a${rank}`, 'rook', color) && rowOpen(['b', 'c', 'd'], rank),
    };
  }
  state.positionHistory = { [positionKey(state)]: 1 };
  return state;
}

/** The puzzle's start position, modifiers active and the solver's first turn begun. */
export function buildPuzzleState(puzzle: Puzzle): GameState {
  let state = buildBareState(puzzle);
  state = chessEngine.activateDraftModifiers(
    state,
    puzzle.modifiers.map(mod => ({
      id: mod.id,
      sourceColor: isSharedDraftModifier(mod.id) ? null : mod.owner,
    })),
  );
  return chessEngine.beginTurn(state);
}

/** Problems that stop the puzzle from being played. Empty when it is ready. */
export function validatePuzzle(puzzle: Puzzle): string[] {
  const problems: string[] = [];
  const seen = new Set<Square>();
  const closed = new Set(puzzle.closed);
  if (closed.size > 60) problems.push('Open at least 4 squares.');
  for (const piece of puzzle.pieces) {
    if (closed.has(piece.square)) problems.push(`${piece.square} is closed, so no piece can stand there.`);
    if (seen.has(piece.square)) problems.push(`Two pieces on ${piece.square}.`);
    seen.add(piece.square);
    if (piece.type === 'pawn' && (piece.square[1] === '1' || piece.square[1] === '8')) {
      problems.push(`Pawn on ${piece.square} cannot stand on the first or last rank.`);
    }
  }
  for (const color of ['white', 'black'] as const) {
    const kings = puzzle.pieces.filter(p => p.color === color && p.type === 'king').length;
    if (kings !== 1) problems.push(`${color === 'white' ? 'White' : 'Black'} needs exactly one king.`);
  }

  for (const mod of puzzle.modifiers) {
    if (!modifierRegistry.get(mod.id)) problems.push(`Modifier ${mod.id} is not playable yet.`);
  }

  const goal = puzzle.goal;
  const limit = goal.type === 'survive' ? goal.rounds : goal.moves;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PUZZLE_MOVES) {
    problems.push(`Goal must be between 1 and ${MAX_PUZZLE_MOVES} moves.`);
  }
  if (goal.type === 'capture') {
    const target = puzzle.pieces.find(p => p.square === goal.target);
    if (!target) problems.push(`There is no piece on ${goal.target} to capture.`);
    else if (target.color === puzzle.toMove) problems.push('The target must be an enemy piece.');
    else if (target.type === 'king') problems.push('Kings cannot be captured. Use a checkmate goal.');
  }

  if (problems.length > 0) return problems;

  const bare = buildBareState(puzzle);
  if (isInCheck(bare, otherColor(puzzle.toMove))) {
    problems.push('The side not to move is in check.');
    return problems;
  }
  const start = buildPuzzleState(puzzle);
  if (start.status !== 'active') problems.push('The game is already over in this position.');
  return problems;
}

export type PuzzleStatus = 'playing' | 'solved' | 'failed';

export interface PuzzleProgress {
  status: PuzzleStatus;
  /** Solver moves (checkmate, capture) or rounds (survive) used so far. */
  used: number;
  limit: number;
  /** One line for the player. */
  message: string;
}

function solverMoveCount(state: GameState, solver: Color): number {
  return state.moveHistory.filter(record => record.move.playerColor === solver).length;
}

/** Plies since the start, the defender's skipped turns included. */
function pliesPlayed(start: GameState, state: GameState): number {
  return state.turnNumber - start.turnNumber;
}

/**
 * Where the solver stands. `start` is the state from buildPuzzleState, used
 * to find the capture target and count rounds.
 */
export function getPuzzleProgress(puzzle: Puzzle, start: GameState, state: GameState): PuzzleProgress {
  const solver = puzzle.toMove;
  const goal = puzzle.goal;
  const winner = getWinner(state);

  if (goal.type === 'survive') {
    const rounds = Math.min(goal.rounds, Math.floor(pliesPlayed(start, state) / 2));
    const base = { used: rounds, limit: goal.rounds };
    if (winner === solver) return { ...base, used: goal.rounds, status: 'solved', message: 'You won outright. Survived!' };
    if (winner === 'draw') return { ...base, used: goal.rounds, status: 'solved', message: 'A draw. You survived.' };
    if (winner) return { ...base, status: 'failed', message: 'You were beaten.' };
    if (rounds >= goal.rounds) return { ...base, status: 'solved', message: `Survived ${goal.rounds} rounds!` };
    return { ...base, status: 'playing', message: `Survive ${goal.rounds - rounds} more round${goal.rounds - rounds === 1 ? '' : 's'}.` };
  }

  const used = solverMoveCount(state, solver);
  const base = { used: Math.min(used, goal.moves), limit: goal.moves };

  if (goal.type === 'checkmate') {
    if (winner === solver) return { ...base, status: 'solved', message: 'Checkmate. Solved!' };
    if (winner) return { ...base, status: 'failed', message: winner === 'draw' ? 'The game ended in a draw.' : 'You were beaten.' };
  } else {
    const targetId = start.pieces.get(goal.target)?.id;
    const target = Array.from(state.pieces.values()).find(piece => piece.id === targetId);
    if (winner === solver || !target || target.color === solver) {
      return { ...base, status: 'solved', message: 'Target taken. Solved!' };
    }
    if (winner) return { ...base, status: 'failed', message: winner === 'draw' ? 'The game ended in a draw.' : 'You were beaten.' };
  }

  if (used >= goal.moves) return { ...base, status: 'failed', message: 'Out of moves.' };
  const left = goal.moves - used;
  return { ...base, status: 'playing', message: `${left} move${left === 1 ? '' : 's'} left.` };
}

export function describeGoal(puzzle: Puzzle): string {
  const side = puzzle.toMove === 'white' ? 'White' : 'Black';
  const goal = puzzle.goal;
  switch (goal.type) {
    case 'checkmate':
      return `${side} to move. Checkmate in ${goal.moves}.`;
    case 'capture': {
      const target = puzzle.pieces.find(p => p.square === goal.target);
      const name = target ? target.type : 'piece';
      return `${side} to move. Capture the ${name} on ${goal.target} in ${goal.moves}.`;
    }
    case 'survive':
      return `${side} to move. Survive ${goal.rounds} round${goal.rounds === 1 ? '' : 's'}.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Share codes
// ─────────────────────────────────────────────────────────────────────────────

const CODE_PREFIX = 'PC1-';
const PIECE_LETTERS: Partial<Record<PieceType, string>> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: 'P',
};
const LETTER_PIECES = Object.fromEntries(
  Object.entries(PIECE_LETTERS).map(([type, letter]) => [letter, type as PieceType]),
);

interface PuzzleWire {
  t: string;
  a: string;
  d: PuzzleDifficulty;
  m: 'w' | 'b';
  p: string;
  x: string[];
  g: [string, number, string?];
  s: number;
  /** Closed squares, "a1 h8". Left out when the board is full. */
  c?: string;
}

// game-core has no DOM or Node typings, so base64 and UTF-8 are done by hand.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  const escaped = encodeURIComponent(text);
  for (let i = 0; i < escaped.length; i++) {
    if (escaped[i] === '%') {
      bytes.push(parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(escaped.charCodeAt(i));
    }
  }
  return bytes;
}

function toBase64Url(text: string): string {
  const bytes = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function fromBase64Url(code: string): string {
  let bits = 0;
  let value = 0;
  let escaped = '';
  for (const char of code) {
    const index = B64.indexOf(char);
    if (index < 0) throw new Error('bad character');
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      escaped += '%' + ((value >> bits) & 255).toString(16).padStart(2, '0');
    }
  }
  return decodeURIComponent(escaped);
}

/** A short text code anyone can paste into the Puzzles screen. */
export function encodePuzzle(puzzle: Puzzle): string {
  const goal = puzzle.goal;
  const wire: PuzzleWire = {
    t: puzzle.title,
    a: puzzle.author,
    d: puzzle.difficulty,
    m: puzzle.toMove === 'white' ? 'w' : 'b',
    // "wKe1 bKe8": color, piece letter, square.
    p: puzzle.pieces
      .map(piece => `${piece.color[0]}${PIECE_LETTERS[piece.type] ?? 'P'}${piece.square}`)
      .join(' '),
    x: puzzle.modifiers.map(mod => (mod.owner ? `${mod.id}:${mod.owner[0]}` : mod.id)),
    g:
      goal.type === 'survive'
        ? ['s', goal.rounds]
        : goal.type === 'capture'
          ? ['c', goal.moves, goal.target]
          : ['m', goal.moves],
    s: puzzle.seed,
  };
  if (puzzle.closed.length > 0) wire.c = puzzle.closed.join(' ');
  return CODE_PREFIX + toBase64Url(JSON.stringify(wire));
}

/** Reads a share code. Throws with a player-facing message when it is not one. */
export function decodePuzzle(code: string, id: string): Puzzle {
  const trimmed = code.trim();
  if (!trimmed.startsWith(CODE_PREFIX)) throw new Error('That is not a puzzle code.');
  let wire: PuzzleWire;
  try {
    wire = JSON.parse(fromBase64Url(trimmed.slice(CODE_PREFIX.length)));
  } catch {
    throw new Error('That puzzle code is damaged.');
  }

  const pieces: PuzzlePiece[] = String(wire.p ?? '')
    .split(' ')
    .filter(Boolean)
    .map(token => {
      const color = token[0] === 'w' ? 'white' : token[0] === 'b' ? 'black' : null;
      const type = LETTER_PIECES[token[1]];
      const square = token.slice(2);
      if (!color || !type || !isSquare(square)) throw new Error('That puzzle code is damaged.');
      return { color, type, square };
    });

  const [kind, limit, target] = Array.isArray(wire.g) ? wire.g : [];
  let goal: PuzzleGoal;
  if (kind === 's') goal = { type: 'survive', rounds: Number(limit) };
  else if (kind === 'c' && isSquare(target)) goal = { type: 'capture', target, moves: Number(limit) };
  else if (kind === 'm') goal = { type: 'checkmate', moves: Number(limit) };
  else throw new Error('That puzzle code is damaged.');

  const modifiers: PuzzleModifier[] = (Array.isArray(wire.x) ? wire.x : []).map(entry => {
    const [modId, owner] = String(entry).split(':');
    return { id: modId, owner: owner === 'w' ? 'white' : owner === 'b' ? 'black' : null };
  });

  const difficulty = PUZZLE_DIFFICULTIES.some(d => d.id === wire.d) ? wire.d : 'egg';
  return {
    id,
    title: String(wire.t ?? 'Untitled puzzle').slice(0, 60),
    author: String(wire.a ?? '').slice(0, 30),
    difficulty,
    toMove: wire.m === 'b' ? 'black' : 'white',
    pieces,
    modifiers,
    goal,
    seed: Number.isFinite(wire.s) ? wire.s | 0 : 1,
    closed: String(wire.c ?? '').split(' ').filter(isSquare),
  };
}

/** a1..h8 in board order, for editors that walk every square. */
export const ALL_SQUARES: Square[] = Array.from({ length: 64 }, (_, i) => {
  return `${FILES[i % 8]}${Math.floor(i / 8) + 1}` as Square;
});
