import { describe, expect, it } from 'vitest';
import { chessEngine } from './ChessEngine';
import type { Color, GameState, ModifierInstance, Move, Piece, PieceType, Square } from './types';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';

const GERALD = MODIFIER_IDS.gerald;
function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

const PACIFIST = MODIFIER_IDS.conscientiousObjector;
const WINTER = MODIFIER_IDS.winterIsComing;

function makePiece(
  type: PieceType,
  color: Color,
  square: Square,
  extras: Partial<Piece> = {},
): Piece {
  return { id: `${color}-${type}-${square}`, type, color, square, cooldowns: {}, ...extras };
}

function makeState(pieces: Piece[], turn: Color, mods: ModifierInstance[] = []): GameState {
  const state = chessEngine.getInitialState();
  state.pieces = new Map(pieces.map(piece => [piece.square, piece]));
  state.activeModifiers = mods;
  state.positionHistory = {};
  state.turn = turn;
  state.flags.castlingRights = {
    white: { kingSide: false, queenSide: false },
    black: { kingSide: false, queenSide: false },
  };
  return state;
}

function move(from: Square, to: Square, playerColor: Color): Move {
  return { from, to, playerColor };
}

const pacifistMod: ModifierInstance = { id: PACIFIST, name: 'Conscientious Objector', activeFor: 'both', sourceColor: 'white' };
const winterMod: ModifierInstance = { id: WINTER, name: 'Winter is Coming', activeFor: 'both', sourceColor: null };
const geraldMod: ModifierInstance = { id: GERALD, name: 'Gerald', activeFor: 'both', sourceColor: 'white' };

describe('modifier-blocked turns', () => {
  it('is checkmate when the only answer to check is a pacifist capture', () => {
    // Nf5-g3+ checks h1. hxg3 is the only engine-legal reply, but h2 refuses to capture.
    const state = makeState([
      makePiece('king', 'white', 'h1'),
      makePiece('pawn', 'white', 'g2'),
      makePiece('pawn', 'white', 'h2', { isPacifist: true }),
      makePiece('knight', 'black', 'f5'),
      makePiece('bishop', 'black', 'c5'),
      makePiece('king', 'black', 'a8'),
    ], 'black', [pacifistMod]);

    const next = chessEngine.applyMove(state, move('f5', 'g3', 'black'));

    expect(next.status).toBe('checkmate');
    expect(next.turn).toBe('white');
    expect(last(next.moveHistory)?.notation).toBe('Ng3#');
  });

  it('keeps the game going when the same pawn is not a pacifist', () => {
    const state = makeState([
      makePiece('king', 'white', 'h1'),
      makePiece('pawn', 'white', 'g2'),
      makePiece('pawn', 'white', 'h2'),
      makePiece('knight', 'black', 'f5'),
      makePiece('bishop', 'black', 'c5'),
      makePiece('king', 'black', 'a8'),
    ], 'black');

    const next = chessEngine.applyMove(state, move('f5', 'g3', 'black'));

    expect(next.status).toBe('active');
    expect(chessEngine.hasAnyValidMove(next)).toBe(true);
  });

  it('skips the turn when modifiers block every move and the king is safe', () => {
    // White's only engine-legal moves are pawn captures by pacifists. Kg1 is covered by Bc5.
    const state = makeState([
      makePiece('king', 'white', 'h1'),
      makePiece('pawn', 'white', 'g2', { isPacifist: true }),
      makePiece('pawn', 'white', 'h2', { isPacifist: true }),
      makePiece('pawn', 'black', 'g3'),
      makePiece('pawn', 'black', 'h3'),
      makePiece('bishop', 'black', 'c5'),
      makePiece('king', 'black', 'a8'),
    ], 'black', [pacifistMod]);

    const next = chessEngine.applyMove(state, move('a8', 'b8', 'black'));

    expect(next.status).toBe('active');
    expect(next.turn).toBe('black');
    expect(last(next.eventHistory)?.title).toBe('No move');
  });

  it('draws when both sides are stuck back to back', () => {
    // Long Winter freezes on everything except Black's b-pawn, which walks into a block.
    const frozen = { cooldowns: { [WINTER]: 10 } };
    const state = makeState([
      makePiece('king', 'white', 'h1', frozen),
      makePiece('pawn', 'white', 'b3', frozen),
      makePiece('king', 'black', 'a8', frozen),
      makePiece('pawn', 'black', 'b5'),
    ], 'black', [winterMod]);

    const next = chessEngine.applyMove(state, move('b5', 'b4', 'black'));

    expect(next.status).toBe('draw');
    expect(next.drawReason).toBe('stalemate');
    expect(last(next.eventHistory)?.title).toBe('No move');
  });

  it('shooing Gerald clears him and spends the turn', () => {
    const state = makeState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1', { cooldowns: { [GERALD]: 2 } }),
      makePiece('pawn', 'black', 'h7'),
      makePiece('king', 'black', 'a8'),
    ], 'white', [geraldMod]);

    expect(chessEngine.canShooGerald(state)).toBe(true);
    const next = chessEngine.shooGerald(state);

    expect(next.turn).toBe('black');
    expect(next.pieces.get('a1')?.cooldowns[GERALD]).toBeUndefined();
    expect(last(next.eventHistory)?.modifierId).toBe(GERALD);

    // Gerald comes back on White's next turn.
    const back = chessEngine.applyMove(next, move('h7', 'h6', 'black'));
    const distracted = Array.from(back.pieces.values()).filter(
      p => p.color === 'white' && (p.cooldowns[GERALD] ?? 0) > 0,
    );
    expect(distracted).toHaveLength(1);
  });

  it('refuses to shoo Gerald or pass while in check', () => {
    const state = makeState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1', { cooldowns: { [GERALD]: 2 } }),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ], 'white', [geraldMod]);

    expect(chessEngine.canShooGerald(state)).toBe(false);
    expect(chessEngine.shooGerald(state)).toBe(state);
    expect(chessEngine.passTurn(state)).toBe(state);
  });

  it('is checkmate when Gerald sits on the only defender', () => {
    // Back-rank check. Rxe1 would answer it, but Gerald holds the a1 rook.
    const state = makeState([
      makePiece('king', 'white', 'h1'),
      makePiece('pawn', 'white', 'g2'),
      makePiece('pawn', 'white', 'h2'),
      makePiece('rook', 'white', 'a1', { cooldowns: { [GERALD]: 2 } }),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ], 'black', [geraldMod]);

    const next = chessEngine.applyMove(state, move('e8', 'e1', 'black'));

    expect(next.status).toBe('checkmate');
    expect(next.turn).toBe('white');
  });
});

describe('repetition from the start position', () => {
  it('counts the initial position toward threefold repetition', () => {
    let state = chessEngine.getInitialState();
    const cycle: Array<[Square, Square, Color]> = [
      ['g1', 'f3', 'white'], ['g8', 'f6', 'black'],
      ['f3', 'g1', 'white'], ['f6', 'g8', 'black'],
    ];
    for (let i = 0; i < 2; i += 1) {
      for (const [from, to, color] of cycle) {
        state = chessEngine.applyMove(state, move(from, to, color));
      }
    }

    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('threefold');
  });
});
