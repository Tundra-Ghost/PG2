import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getPigeonBotMove } from '../engine/bot';
import type { GameState, Square } from '../engine/types';
import { modifierRegistry } from '../modifiers/registry';
import '../modifiers/index';
import {
  buildPuzzleState,
  createEmptyPuzzle,
  decodePuzzle,
  describeGoal,
  encodePuzzle,
  getPuzzleProgress,
  validatePuzzle,
  type Puzzle,
} from './puzzle';

/** Back-rank mate: Ra8#. */
function backRankPuzzle(): Puzzle {
  return {
    ...createEmptyPuzzle('t1'),
    title: 'Back rank',
    pieces: [
      { square: 'g1', type: 'king', color: 'white' },
      { square: 'a1', type: 'rook', color: 'white' },
      { square: 'g8', type: 'king', color: 'black' },
      { square: 'f7', type: 'pawn', color: 'black' },
      { square: 'g7', type: 'pawn', color: 'black' },
      { square: 'h7', type: 'pawn', color: 'black' },
    ],
    goal: { type: 'checkmate', moves: 1 },
  };
}

function play(state: GameState, from: Square, to: Square): GameState {
  return chessEngine.applyMove(state, { from, to, playerColor: state.turn });
}

describe('buildPuzzleState', () => {
  it('places the pieces with the solver to move', () => {
    const puzzle = { ...backRankPuzzle(), toMove: 'black' as const };
    const state = buildPuzzleState(puzzle);
    expect(state.pieces.size).toBe(6);
    expect(state.pieces.get('a1')?.type).toBe('rook');
    expect(state.turn).toBe('black');
    expect(state.status).toBe('active');
  });

  it('allows castling only with king and rook at home', () => {
    const puzzle: Puzzle = {
      ...createEmptyPuzzle('c'),
      pieces: [
        { square: 'e1', type: 'king', color: 'white' },
        { square: 'h1', type: 'rook', color: 'white' },
        { square: 'b1', type: 'rook', color: 'white' },
        { square: 'e8', type: 'king', color: 'black' },
      ],
    };
    const state = buildPuzzleState(puzzle);
    expect(state.flags.castlingRights.white).toEqual({ kingSide: true, queenSide: false });
    expect(state.flags.castlingRights.black).toEqual({ kingSide: false, queenSide: false });
  });

  it('is the same every time for the same seed', () => {
    const puzzle: Puzzle = {
      ...backRankPuzzle(),
      modifiers: [{ id: 'MOD-A002', owner: null }],
      seed: 42,
    };
    const a = buildPuzzleState(puzzle);
    const b = buildPuzzleState(puzzle);
    expect(Array.from(a.tiles.keys()).sort()).toEqual(Array.from(b.tiles.keys()).sort());
  });

  it('survives every playable modifier on a sparse board', () => {
    for (const def of modifierRegistry.getAll()) {
      const puzzle: Puzzle = { ...backRankPuzzle(), modifiers: [{ id: def.id, owner: 'white' }] };
      const state = buildPuzzleState(puzzle);
      expect(state.pieces.size, def.id).toBeGreaterThan(0);
      // The defender can still answer a move.
      const first = chessEngine.applyMove(state, { from: 'g1', to: 'h1', playerColor: 'white' });
      expect(() => getPigeonBotMove(first, 'black'), def.id).not.toThrow();
    }
  });
});

describe('validatePuzzle', () => {
  it('accepts a sound puzzle', () => {
    expect(validatePuzzle(backRankPuzzle())).toEqual([]);
  });

  it('needs one king per side', () => {
    const puzzle = { ...backRankPuzzle(), pieces: backRankPuzzle().pieces.filter(p => p.square !== 'g8') };
    expect(validatePuzzle(puzzle)).toContain('Black needs exactly one king.');
  });

  it('refuses pawns on the back ranks', () => {
    const puzzle = backRankPuzzle();
    puzzle.pieces.push({ square: 'c8', type: 'pawn', color: 'white' });
    expect(validatePuzzle(puzzle)[0]).toMatch(/c8/);
  });

  it('refuses a position where the defender is already in check', () => {
    const puzzle = backRankPuzzle();
    puzzle.pieces = puzzle.pieces.map(p => (p.square === 'a1' ? { ...p, square: 'a8' } : p));
    expect(validatePuzzle(puzzle)).toEqual(['The side not to move is in check.']);
  });

  it('checks the capture target', () => {
    const own = { ...backRankPuzzle(), goal: { type: 'capture' as const, target: 'a1' as Square, moves: 2 } };
    expect(validatePuzzle(own)).toContain('The target must be an enemy piece.');
    const empty = { ...backRankPuzzle(), goal: { type: 'capture' as const, target: 'd4' as Square, moves: 2 } };
    expect(validatePuzzle(empty)[0]).toMatch(/no piece on d4/);
  });

  it('refuses unknown modifiers and silly move counts', () => {
    const puzzle = { ...backRankPuzzle(), modifiers: [{ id: 'MOD-Z999', owner: null }], goal: { type: 'checkmate' as const, moves: 0 } };
    const problems = validatePuzzle(puzzle);
    expect(problems.some(p => p.includes('MOD-Z999'))).toBe(true);
    expect(problems.some(p => p.includes('between 1 and'))).toBe(true);
  });
});

describe('getPuzzleProgress', () => {
  it('solves a mate in one', () => {
    const puzzle = backRankPuzzle();
    const start = buildPuzzleState(puzzle);
    expect(getPuzzleProgress(puzzle, start, start).status).toBe('playing');
    const done = play(start, 'a1', 'a8');
    expect(getPuzzleProgress(puzzle, start, done)).toMatchObject({ status: 'solved', used: 1 });
  });

  it('fails when the moves run out', () => {
    const puzzle = backRankPuzzle();
    const start = buildPuzzleState(puzzle);
    const missed = play(start, 'a1', 'a7');
    expect(getPuzzleProgress(puzzle, start, missed)).toMatchObject({ status: 'failed', message: 'Out of moves.' });
  });

  it('solves a capture goal', () => {
    const puzzle: Puzzle = { ...backRankPuzzle(), goal: { type: 'capture', target: 'h7', moves: 2 } };
    const start = buildPuzzleState(puzzle);
    let state = play(start, 'a1', 'a7');
    expect(getPuzzleProgress(puzzle, start, state).status).toBe('playing');
    state = play(state, 'g8', 'f8');
    state = play(state, 'a7', 'b7');
    expect(getPuzzleProgress(puzzle, start, state).status).toBe('failed');

    let win = play(start, 'a1', 'a7');
    win = play(win, 'g8', 'f8');
    win = play(win, 'a7', 'f7');
    // f7 is not the target, h7 is.
    expect(getPuzzleProgress(puzzle, start, win).status).toBe('failed');
  });

  it('counts survive rounds', () => {
    const puzzle: Puzzle = { ...backRankPuzzle(), goal: { type: 'survive', rounds: 1 } };
    const start = buildPuzzleState(puzzle);
    let state = play(start, 'g1', 'h1');
    expect(getPuzzleProgress(puzzle, start, state).status).toBe('playing');
    state = play(state, 'h7', 'h6');
    expect(getPuzzleProgress(puzzle, start, state)).toMatchObject({ status: 'solved', used: 1 });
  });
});

describe('share codes', () => {
  it('round-trips a puzzle', () => {
    const puzzle: Puzzle = {
      ...backRankPuzzle(),
      title: 'Pigeon’s revenge 🐦',
      author: 'Tanner',
      difficulty: 'grandmaster',
      toMove: 'white',
      modifiers: [
        { id: 'MOD-A002', owner: null },
        { id: 'MOD-E006', owner: 'black' },
      ],
      goal: { type: 'capture', target: 'h7', moves: 3 },
      seed: 1234,
    };
    const code = encodePuzzle(puzzle);
    expect(code.startsWith('PC1-')).toBe(true);
    expect(decodePuzzle(code, 't1')).toEqual(puzzle);
  });

  it('rejects junk', () => {
    expect(() => decodePuzzle('hello', 'x')).toThrow('not a puzzle code');
    expect(() => decodePuzzle('PC1-!!!!', 'x')).toThrow('damaged');
  });
});

describe('describeGoal', () => {
  it('reads like a puzzle prompt', () => {
    expect(describeGoal(backRankPuzzle())).toBe('White to move. Checkmate in 1.');
    expect(describeGoal({ ...backRankPuzzle(), goal: { type: 'capture', target: 'h7', moves: 2 } })).toBe(
      'White to move. Capture the pawn on h7 in 2.',
    );
  });
});

describe('board shapes', () => {
  it('closed squares block moves and slides', () => {
    const puzzle: Puzzle = { ...backRankPuzzle(), closed: ['a5', 'b1'] };
    const state = buildPuzzleState(puzzle);
    const rookMoves = chessEngine.getLegalMoves(state, 'a1');
    expect(rookMoves).toContain('a4');
    expect(rookMoves).not.toContain('a5');
    expect(rookMoves).not.toContain('a8');
    expect(rookMoves).not.toContain('b1');
    expect(rookMoves).not.toContain('c1');
  });

  it('a pawn facing a closed square promotes', () => {
    const puzzle: Puzzle = {
      ...createEmptyPuzzle('promo'),
      pieces: [
        { square: 'a1', type: 'king', color: 'white' },
        { square: 'h8', type: 'king', color: 'black' },
        { square: 'd5', type: 'pawn', color: 'white' },
      ],
      closed: ['d7', 'd8'],
    };
    const state = buildPuzzleState(puzzle);
    expect(chessEngine.getLegalMoves(state, 'd5')).toEqual(['d6']);
    expect(chessEngine.isPromotionMove(state, 'd5', 'd6')).toBe(true);
    const promoted = chessEngine.applyMove(state, { from: 'd5', to: 'd6', playerColor: 'white', promotion: 'queen' });
    expect(promoted.pieces.get('d6')?.type).toBe('queen');
  });

  it('turns castling off when the path is closed', () => {
    const puzzle: Puzzle = {
      ...createEmptyPuzzle('c'),
      pieces: [
        { square: 'e1', type: 'king', color: 'white' },
        { square: 'h1', type: 'rook', color: 'white' },
        { square: 'a1', type: 'rook', color: 'white' },
        { square: 'e8', type: 'king', color: 'black' },
      ],
      closed: ['b1'],
    };
    expect(buildPuzzleState(puzzle).flags.castlingRights.white).toEqual({ kingSide: true, queenSide: false });
  });

  it('refuses pieces on closed squares', () => {
    const puzzle: Puzzle = { ...backRankPuzzle(), closed: ['a1'] };
    expect(validatePuzzle(puzzle)).toContain('a1 is closed, so no piece can stand there.');
  });

  it('keeps the shape in share codes, and old codes still read', () => {
    const shaped: Puzzle = { ...backRankPuzzle(), closed: ['a8', 'h1', 'd4'] };
    expect(decodePuzzle(encodePuzzle(shaped), 't1')).toEqual(shaped);
    expect(encodePuzzle(backRankPuzzle())).not.toContain('"c"');
    expect(decodePuzzle(encodePuzzle(backRankPuzzle()), 't1').closed).toEqual([]);
  });
});
