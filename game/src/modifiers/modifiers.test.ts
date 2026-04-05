import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type {
  Color,
  GameState,
  Move,
  Piece,
  PieceType,
  Square,
} from '../engine/types';
import './index';

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

describe('shipped modifier behavior', () => {
  it('floor is lava does not kill kings standing on lava tiles', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'h8'),
    ]);

    state.activeModifiers = [
      { id: 'MOD-A002', name: 'Floor is Lava', activeFor: 'both', sourceColor: null },
    ];
    state.tiles.set('e1', {
      square: 'e1',
      effects: [{ type: 'lava', turnsRemaining: -1 }],
    });

    const next = chessEngine.beginTurn(state);

    expect(next.pieces.get('e1')?.type).toBe('king');
    expect(next.eventHistory).toHaveLength(0);
  });

  it('gerald keeps a piece blocked across the opponent turn before it can clear', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('rook', 'white', 'a1'),
        makePiece('bishop', 'white', 'c1'),
        makePiece('king', 'black', 'e8'),
      ]),
      [{ id: 'MOD-B002', sourceColor: 'white' }],
    );

    state.prngState = 1;
    state = chessEngine.beginTurn(state);

    const blockedPiece = Array.from(state.pieces.values()).find(
      piece => piece.color === 'white' && (piece.cooldowns['MOD-B002'] ?? 0) > 0,
    );
    expect(blockedPiece).toBeDefined();
    expect(
      chessEngine.validateMove(
        state,
        move(blockedPiece!.square, blockedPiece!.square === 'a1' ? 'a2' : 'b2', 'white'),
      ),
    ).toEqual({
      valid: false,
      reason: 'Gerald is still distracting that piece.',
    });

    state = chessEngine.passTurn(state);
    state = chessEngine.passTurn(state);

    expect(state.pieces.get(blockedPiece!.square)?.cooldowns['MOD-B002']).toBe(1);

    expect(
      chessEngine.validateMove(
        state,
        move(blockedPiece!.square, blockedPiece!.square === 'a1' ? 'a2' : 'b2', 'white'),
      ),
    ).toEqual({
      valid: false,
      reason: 'Gerald is still distracting that piece.',
    });
  });

  it('winter freezes pieces that enter the opponent home zone for one turn', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('king', 'black', 'e8'),
        makePiece('rook', 'white', 'a6'),
      ]),
      [{ id: 'MOD-A004', sourceColor: 'white' }],
    );

    const next = chessEngine.applyMove(state, move('a6', 'a7', 'white'));

    expect(next.pieces.get('a7')?.cooldowns['MOD-A004']).toBe(2);

    const afterBlackTurn = chessEngine.passTurn(next);

    expect(afterBlackTurn.turn).toBe('white');
    expect(afterBlackTurn.pieces.get('a7')?.cooldowns['MOD-A004']).toBe(1);
    expect(chessEngine.validateMove(afterBlackTurn, move('a7', 'a8', 'white'))).toEqual({
      valid: false,
      reason: 'That piece is frozen by Winter is Coming.',
    });

    const afterFrozenTurn = chessEngine.passTurn(afterBlackTurn);
    expect(afterFrozenTurn.pieces.get('a7')?.cooldowns['MOD-A004']).toBe(1);

    const thawed = chessEngine.passTurn(afterFrozenTurn);
    expect(thawed.pieces.get('a7')?.cooldowns['MOD-A004']).toBeUndefined();
  });

  it('conscientious objector blocks captures but still allows non-capturing moves', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      { ...makePiece('pawn', 'white', 'e5'), isPacifist: true },
      makePiece('pawn', 'black', 'd6'),
      makePiece('king', 'black', 'e8'),
    ]);

    state.activeModifiers = [
      {
        id: 'MOD-B007',
        name: 'Conscientious Objector',
        activeFor: 'both',
        sourceColor: 'white',
      },
    ];

    expect(chessEngine.validateMove(state, move('e5', 'd6', 'white'))).toEqual({
      valid: false,
      reason: 'The Conscientious Objector refuses to capture.',
    });
    expect(chessEngine.validateMove(state, move('e5', 'e6', 'white'))).toEqual({
      valid: true,
    });
  });

  it('conscientious objector also refuses en passant captures', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      { ...makePiece('pawn', 'white', 'e5'), isPacifist: true },
      makePiece('pawn', 'black', 'd5'),
      makePiece('king', 'black', 'e8'),
    ]);

    state.activeModifiers = [
      {
        id: 'MOD-B007',
        name: 'Conscientious Objector',
        activeFor: 'both',
        sourceColor: 'white',
      },
    ];
    state.flags.enPassantSquare = 'd6';

    expect(
      chessEngine.validateMove(state, move('e5', 'd6', 'white', { isEnPassant: true })),
    ).toEqual({
      valid: false,
      reason: 'The Conscientious Objector refuses to capture.',
    });
  });

  it('gerald never targets kings when selecting a distracted piece', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('rook', 'white', 'a1'),
        makePiece('king', 'black', 'e8'),
      ]),
      [{ id: 'MOD-B002', sourceColor: 'white' }],
    );

    state.prngState = 0;
    state = chessEngine.beginTurn(state);

    expect(state.pieces.get('e1')?.cooldowns['MOD-B002']).toBeUndefined();
    expect(state.pieces.get('a1')?.cooldowns['MOD-B002']).toBeGreaterThan(0);
  });

  it('floor is lava places hazards only on empty tiles at activation', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('queen', 'white', 'd1'),
        makePiece('king', 'black', 'e8'),
        makePiece('queen', 'black', 'd8'),
      ]),
      [{ id: 'MOD-A002', sourceColor: null }],
    );

    const lavaSquares = Array.from(state.tiles.keys());

    expect(lavaSquares).toHaveLength(4);
    expect(lavaSquares.every(square => !state.pieces.has(square))).toBe(true);
  });

  it('berserker chains only into captures that keep its king safe', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      { ...makePiece('rook', 'white', 'e2'), isBerserker: true },
      makePiece('king', 'black', 'a8'),
      makePiece('rook', 'black', 'e8'),
      makePiece('knight', 'black', 'e3'),
      makePiece('queen', 'black', 'h3'),
    ]);

    state.activeModifiers = [
      { id: 'MOD-E006', name: 'Berserker', activeFor: 'both', sourceColor: 'white' },
    ];

    const next = chessEngine.applyMove(state, move('e2', 'e3', 'white'));

    expect(next.pieces.has('h3')).toBe(true);
    expect(chessEngine.isInCheck(next, 'white')).toBe(false);

    const chainEvent = next.modifierState['MOD-E006'] as
      | { to?: Square }
      | undefined;
    expect(chainEvent?.to).not.toBe('h3');
    expect(chessEngine.isInCheck(next, 'white')).toBe(false);
  });
});
