import { describe, expect, it } from 'vitest';
import { chessEngine } from './ChessEngine';
import type {
  BerserkerChainEvent,
  Color,
  GameState,
  Move,
  Piece,
  PieceType,
  Square,
} from './types';
import '../modifiers/index';

function makePiece(
  type: PieceType,
  color: Color,
  square: Square,
  id = `${color}-${type}-${square}`,
): Piece {
  return {
    id,
    type,
    color,
    square,
    cooldowns: {},
  };
}

function makeEmptyState(pieces: Piece[]): GameState {
  const state = chessEngine.getInitialState();
  state.pieces = new Map(pieces.map(piece => [piece.square, piece]));
  state.tiles = new Map();
  state.activeModifiers = [];
  state.modifierState = {};
  state.moveHistory = [];
  state.eventHistory = [];
  state.positionHistory = {};
  state.turn = 'white';
  state.turnNumber = 1;
  state.status = 'active';
  state.drawReason = undefined;
  state.flags = {
    enPassantSquare: null,
    castlingRights: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    halfMoveClock: 0,
    fullMoveNumber: 1,
  };
  return state;
}

function move(
  from: Square,
  to: Square,
  playerColor: Color,
  extras: Partial<Move> = {},
): Move {
  return {
    from,
    to,
    playerColor,
    ...extras,
  };
}

describe('ChessEngine TDD baseline', () => {
  it('allows an opening pawn to move one or two squares', () => {
    const state = chessEngine.getInitialState();

    expect(chessEngine.getLegalMoves(state, 'e2')).toEqual(['e3', 'e4']);
  });

  it('rejects moves for the wrong side to move', () => {
    const state = chessEngine.getInitialState();

    expect(chessEngine.validateMove(state, move('e7', 'e5', 'black'))).toEqual({
      valid: false,
      reason: 'not your turn',
    });
  });

  it('supports en passant after a qualifying double pawn push', () => {
    let state = chessEngine.getInitialState();

    state = chessEngine.applyMove(state, move('e2', 'e4', 'white'));
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    state = chessEngine.applyMove(state, move('e4', 'e5', 'white'));
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));

    const enPassant = move('e5', 'd6', 'white', { isEnPassant: true });

    expect(chessEngine.validateMove(state, enPassant)).toEqual({ valid: true });

    state = chessEngine.applyMove(state, enPassant);

    expect(state.pieces.has('d5')).toBe(false);
    expect(state.pieces.get('d6')?.type).toBe('pawn');
    expect(state.pieces.get('d6')?.color).toBe('white');
  });

  it('rejects castling through check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('king', 'black', 'a8'),
      makePiece('rook', 'black', 'f8'),
    ]);

    state.flags.castlingRights.white.kingSide = true;

    expect(
      chessEngine.validateMove(
        state,
        move('e1', 'g1', 'white', { isCastle: 'kingside' }),
      ),
    ).toEqual({
      valid: false,
      reason: 'cannot castle through check',
    });
  });

  it('detects a promotion move on the back rank', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'a7'),
    ]);

    expect(chessEngine.isPromotionMove(state, 'a7', 'a8')).toBe(true);
    expect(chessEngine.validateMove(state, move('a7', 'a8', 'white'))).toEqual({
      valid: true,
    });
  });

  it("detects Fool's Mate as checkmate", () => {
    let state = chessEngine.getInitialState();

    state = chessEngine.applyMove(state, move('f2', 'f3', 'white'));
    state = chessEngine.applyMove(state, move('e7', 'e5', 'black'));
    state = chessEngine.applyMove(state, move('g2', 'g4', 'white'));
    state = chessEngine.applyMove(state, move('d8', 'h4', 'black'));

    expect(state.status).toBe('checkmate');
    expect(chessEngine.isCheckmate(state, 'white')).toBe(true);
  });

  it('records berserker chain captures for UI feedback', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('king', 'black', 'h8'),
      { ...makePiece('rook', 'white', 'a1'), isBerserker: true },
      makePiece('knight', 'black', 'a4'),
      makePiece('queen', 'black', 'a8'),
    ]);

    state.activeModifiers = [
      { id: 'MOD-E006', name: 'Berserker', activeFor: 'both', sourceColor: null },
    ];

    const next = chessEngine.applyMove(state, move('a1', 'a4', 'white'));
    const event = next.modifierState['MOD-E006'] as BerserkerChainEvent;

    expect(next.pieces.get('a8')?.isBerserker).toBe(true);
    expect(next.pieces.has('a4')).toBe(false);
    expect(next.pieces.has('a8')).toBe(true);
    expect(event).toMatchObject({
      counter: 1,
      from: 'a4',
      to: 'a8',
      capturedType: 'queen',
    });
    expect(next.eventHistory[next.eventHistory.length - 1]).toMatchObject({
      ply: 1,
      modifierId: 'MOD-E006',
      title: 'Berserker',
    });
  });

  it('records lava deaths in event history', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('king', 'black', 'h8'),
      makePiece('rook', 'white', 'a1'),
    ]);

    state.activeModifiers = [
      { id: 'MOD-A002', name: 'Floor is Lava', activeFor: 'both', sourceColor: null },
    ];
    state.tiles.set('a4', {
      square: 'a4',
      effects: [{ type: 'lava', turnsRemaining: -1 }],
    });

    const next = chessEngine.applyMove(state, move('a1', 'a4', 'white'));

    expect(next.pieces.has('a4')).toBe(false);
    expect(next.eventHistory[next.eventHistory.length - 1]).toMatchObject({
      ply: 1,
      modifierId: 'MOD-A002',
      title: 'Lava',
      message: 'white rook on a4 burned up on lava.',
    });
  });

  it('preserves draft ownership on activated modifiers', () => {
    const state = chessEngine.activateDraftModifiers(
      chessEngine.getInitialState(),
      [
        { id: 'MOD-A002', sourceColor: 'white' },
        { id: 'MOD-B002', sourceColor: 'black' },
      ],
    );

    expect(state.activeModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'MOD-A002', sourceColor: 'white' }),
        expect.objectContaining({ id: 'MOD-B002', sourceColor: 'black' }),
      ]),
    );
  });
});
