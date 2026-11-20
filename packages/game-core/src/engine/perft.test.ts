import { describe, expect, it } from 'vitest';
import { chessEngine } from './ChessEngine';
import { buildMove } from './gameLoop';
import { makeEmptyState, makePiece } from '../modifiers/testHelpers';
import type { Color, GameState, PieceType, Square } from './types';

/**
 * Perft: count every legal move sequence to a fixed depth and compare with
 * the published numbers (chessprogramming.org/Perft_Results). Any bug in
 * castling, en passant, promotion, pins or check shows up as a wrong count.
 * Plain chess only; modifiers have their own tests.
 */

const LETTERS: Record<string, PieceType> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const PROMOTIONS: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

function fromFen(fen: string): GameState {
  const [board, side, castling, ep] = fen.split(' ');
  const pieces = [];
  const ranks = board.split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of ranks[r]) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      const square = `${'abcdefgh'[f]}${8 - r}` as Square;
      const color: Color = ch === ch.toUpperCase() ? 'white' : 'black';
      pieces.push(makePiece(LETTERS[ch.toLowerCase()], color, square));
      f++;
    }
  }
  const state = makeEmptyState(pieces);
  state.turn = side === 'b' ? 'black' : 'white';
  state.flags.castlingRights = {
    white: { kingSide: castling.includes('K'), queenSide: castling.includes('Q') },
    black: { kingSide: castling.includes('k'), queenSide: castling.includes('q') },
  };
  state.flags.enPassantSquare = ep && ep !== '-' ? (ep as Square) : null;
  return state;
}

function perft(state: GameState, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const piece of [...state.pieces.values()]) {
    if (piece.color !== state.turn) continue;
    for (const to of chessEngine.getLegalMoves(state, piece.square)) {
      const promoting = chessEngine.isPromotionMove(state, piece.square, to);
      for (const promotion of promoting ? PROMOTIONS : [undefined]) {
        if (depth === 1) {
          nodes++;
          continue;
        }
        const move = { ...buildMove(state, piece.square, to), ...(promotion ? { promotion } : {}) };
        nodes += perft(chessEngine.applyMove(state, move), depth - 1);
      }
    }
  }
  return nodes;
}

const CASES: Array<[string, string, number[]]> = [
  ['start position', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', [20, 400, 8902]],
  ['Kiwipete (castling, pins, en passant)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -', [48, 2039, 97862]],
  ['position 3 (en passant pins, rook endgame)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -', [14, 191, 2812, 43238]],
  ['position 4 (promotions, checks)', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -', [6, 264, 9467]],
  ['position 5 (promotion with capture)', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -', [44, 1486, 62379]],
];

describe('perft (plain chess move generation)', () => {
  for (const [name, fen, counts] of CASES) {
    it(name, () => {
      const state = fromFen(fen);
      counts.forEach((expected, i) => expect(perft(state, i + 1)).toBe(expected));
    }, 60_000);
  }
});
