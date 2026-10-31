import type { Puzzle, Square } from '@pigeon-chess/game-core';

const SIX_BY_SIX_RING = [...'abcdefgh'].flatMap(file =>
  [...'12345678']
    .filter(rank => file === 'a' || file === 'h' || rank === '1' || rank === '8')
    .map(rank => `${file}${rank}` as Square),
);

/** Built-in puzzles so the mode is never empty. Players can copy them into the editor. */
export const STARTER_PUZZLES: Puzzle[] = [
  {
    id: 'starter-back-rank',
    title: 'Back rank blues',
    author: 'Viktor',
    difficulty: 'egg',
    toMove: 'white',
    pieces: [
      { square: 'g1', type: 'king', color: 'white' },
      { square: 'a1', type: 'rook', color: 'white' },
      { square: 'f2', type: 'pawn', color: 'white' },
      { square: 'g2', type: 'pawn', color: 'white' },
      { square: 'h2', type: 'pawn', color: 'white' },
      { square: 'g8', type: 'king', color: 'black' },
      { square: 'f7', type: 'pawn', color: 'black' },
      { square: 'g7', type: 'pawn', color: 'black' },
      { square: 'h7', type: 'pawn', color: 'black' },
    ],
    modifiers: [],
    goal: { type: 'checkmate', moves: 1 },
    seed: 1,
    closed: [],
  },
  {
    id: 'starter-royal-fork',
    title: 'Royal fork',
    author: 'Viktor',
    difficulty: 'hatchling',
    toMove: 'white',
    pieces: [
      { square: 'g1', type: 'king', color: 'white' },
      { square: 'e1', type: 'rook', color: 'white' },
      { square: 'd5', type: 'knight', color: 'white' },
      { square: 'f2', type: 'pawn', color: 'white' },
      { square: 'g2', type: 'pawn', color: 'white' },
      { square: 'h2', type: 'pawn', color: 'white' },
      { square: 'g8', type: 'king', color: 'black' },
      { square: 'c8', type: 'queen', color: 'black' },
      { square: 'f7', type: 'pawn', color: 'black' },
      { square: 'g7', type: 'pawn', color: 'black' },
      { square: 'h7', type: 'pawn', color: 'black' },
    ],
    modifiers: [],
    goal: { type: 'capture', target: 'c8', moves: 2 },
    seed: 1,
    closed: [],
  },
  {
    id: 'starter-hot-floor',
    title: 'Hot floor, cold feet',
    author: 'Viktor',
    difficulty: 'hatchling',
    toMove: 'white',
    pieces: [
      { square: 'e1', type: 'king', color: 'white' },
      { square: 'a2', type: 'rook', color: 'white' },
      { square: 'd2', type: 'pawn', color: 'white' },
      { square: 'e2', type: 'pawn', color: 'white' },
      { square: 'f2', type: 'pawn', color: 'white' },
      { square: 'e8', type: 'king', color: 'black' },
      { square: 'd8', type: 'queen', color: 'black' },
      { square: 'h8', type: 'rook', color: 'black' },
      { square: 'f7', type: 'pawn', color: 'black' },
      { square: 'g7', type: 'pawn', color: 'black' },
    ],
    modifiers: [{ id: 'MOD-A002', owner: null }],
    goal: { type: 'survive', rounds: 4 },
    seed: 7,
    closed: [],
  },
  {
    id: 'starter-small-world',
    title: 'Small world',
    author: 'Viktor',
    difficulty: 'egg',
    toMove: 'white',
    pieces: [
      { square: 'b5', type: 'king', color: 'white' },
      { square: 'g2', type: 'rook', color: 'white' },
      { square: 'b7', type: 'king', color: 'black' },
    ],
    modifiers: [],
    goal: { type: 'checkmate', moves: 1 },
    seed: 1,
    // A 6×6 board: the outer ring is closed, so the edge comes sooner.
    closed: SIX_BY_SIX_RING,
  },
];
