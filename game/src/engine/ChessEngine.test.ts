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
import { modifierRegistry } from '../modifiers/registry';
import type { ModifierDefinition } from '../modifiers/types';

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

  it('allows castling when the lane is clear and safe', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('king', 'black', 'a8'),
    ]);

    state.flags.castlingRights.white.kingSide = true;

    expect(
      chessEngine.validateMove(
        state,
        move('e1', 'g1', 'white', { isCastle: 'kingside' }),
      ),
    ).toEqual({ valid: true });

    const next = chessEngine.applyMove(
      state,
      move('e1', 'g1', 'white', { isCastle: 'kingside' }),
    );

    expect(next.pieces.get('g1')?.type).toBe('king');
    expect(next.pieces.get('f1')?.type).toBe('rook');
    expect(next.flags.castlingRights.white).toEqual({
      kingSide: false,
      queenSide: false,
    });
  });

  it('allows queenside castling when the lane is clear and safe', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]);

    state.flags.castlingRights.white.queenSide = true;

    expect(
      chessEngine.validateMove(
        state,
        move('e1', 'c1', 'white', { isCastle: 'queenside' }),
      ),
    ).toEqual({ valid: true });

    const next = chessEngine.applyMove(
      state,
      move('e1', 'c1', 'white', { isCastle: 'queenside' }),
    );

    expect(next.pieces.get('c1')?.type).toBe('king');
    expect(next.pieces.get('d1')?.type).toBe('rook');
  });

  it('rejects queenside castling through an attacked intermediate square', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
      makePiece('rook', 'black', 'd8'),
    ]);

    state.flags.castlingRights.white.queenSide = true;

    expect(
      chessEngine.validateMove(
        state,
        move('e1', 'c1', 'white', { isCastle: 'queenside' }),
      ),
    ).toEqual({
      valid: false,
      reason: 'cannot castle through check',
    });
  });

  it('removes castling rights after a rook moves off its home square', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('king', 'black', 'a8'),
    ]);

    state.flags.castlingRights.white = {
      kingSide: true,
      queenSide: true,
    };

    const next = chessEngine.applyMove(state, move('h1', 'h3', 'white'));

    expect(next.flags.castlingRights.white).toEqual({
      kingSide: false,
      queenSide: true,
    });
  });

  it('removes castling rights when a home rook is captured', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'e8'),
      makePiece('bishop', 'black', 'c3'),
    ]);

    state.turn = 'black';
    state.flags.castlingRights.white = {
      kingSide: true,
      queenSide: true,
    };

    const next = chessEngine.applyMove(state, move('c3', 'a1', 'black'));

    expect(next.flags.castlingRights.white).toEqual({
      kingSide: true,
      queenSide: false,
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

  it('applies pawn promotion to the selected piece type', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'white', 'a7'),
    ]);

    const next = chessEngine.applyMove(
      state,
      move('a7', 'a8', 'white', { promotion: 'queen' }),
    );

    expect(next.pieces.get('a8')).toMatchObject({
      type: 'queen',
      color: 'white',
    });
    expect(next.moveHistory[next.moveHistory.length - 1]?.notation).toBe('a8=Q+');
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

  it('detects stalemate when the side to move has no legal moves and is not in check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'c6'),
      makePiece('queen', 'white', 'b6'),
      makePiece('king', 'black', 'a8'),
    ]);

    state.turn = 'black';

    expect(chessEngine.isInCheck(state, 'black')).toBe(false);
    expect(chessEngine.isStalemate(state, 'black')).toBe(true);
  });

  it('rejects a move that exposes the moving side king to check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'e2'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);

    expect(chessEngine.validateMove(state, move('e2', 'f2', 'white'))).toEqual({
      valid: false,
      reason: 'leaves king in check',
    });
  });

  it('declares a draw by insufficient material', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'e8'),
    ]);

    const next = chessEngine.passTurn(state);

    expect(next.status).toBe('draw');
    expect(next.drawReason).toBe('insufficient');
  });

  it('declares a draw on the 50-move rule threshold', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'e8'),
      makePiece('knight', 'white', 'g1'),
      makePiece('knight', 'black', 'g8'),
    ]);

    state.flags.halfMoveClock = 99;

    const next = chessEngine.passTurn(state);

    expect(next.status).toBe('draw');
    expect(next.drawReason).toBe('50-move');
  });

  it('declares a draw after the third repetition of the same position', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('knight', 'white', 'b1'),
      makePiece('king', 'black', 'e8'),
      makePiece('knight', 'black', 'g8'),
    ]);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      state = chessEngine.applyMove(state, move('b1', 'a3', 'white'));
      state = chessEngine.applyMove(state, move('g8', 'h6', 'black'));
      state = chessEngine.applyMove(state, move('a3', 'b1', 'white'));
      state = chessEngine.applyMove(state, move('h6', 'g8', 'black'));
    }

    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('threefold');
  });

  it('expires en passant if it is not taken immediately', () => {
    let state = chessEngine.getInitialState();

    state = chessEngine.applyMove(state, move('e2', 'e4', 'white'));
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    state = chessEngine.applyMove(state, move('e4', 'e5', 'white'));
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    state = chessEngine.applyMove(state, move('g1', 'f3', 'white'));
    state = chessEngine.applyMove(state, move('a6', 'a5', 'black'));

    expect(
      chessEngine.validateMove(state, move('e5', 'd6', 'white', { isEnPassant: true })),
    ).toEqual({
      valid: false,
      reason: 'illegal move for piece type',
    });
  });

  it('allows a pinned piece to move along the pin line when it still shields the king', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'e2'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);

    expect(chessEngine.validateMove(state, move('e2', 'e3', 'white'))).toEqual({
      valid: true,
    });
  });

  it('allows only king moves to resolve a double check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('rook', 'black', 'e8'),
      makePiece('bishop', 'black', 'b4'),
      makePiece('king', 'black', 'h8'),
    ]);

    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(chessEngine.validateMove(state, move('a1', 'a8', 'white'))).toEqual({
      valid: false,
      reason: 'leaves king in check',
    });
    expect(chessEngine.getLegalMoves(state, 'e1')).toContain('f1');
  });

  it('adds file disambiguation to SAN when two knights can reach the same square', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'h8'),
      makePiece('knight', 'white', 'd2'),
      makePiece('knight', 'white', 'h2'),
    ]);

    const next = chessEngine.applyMove(state, move('d2', 'f3', 'white'));

    expect(next.moveHistory[next.moveHistory.length - 1]?.notation).toBe('Ndf3');
  });

  it('adds rank disambiguation to SAN when two rooks on the same file can reach the target square', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'h8'),
      makePiece('rook', 'white', 'a1'),
      makePiece('rook', 'white', 'a8'),
    ]);

    const next = chessEngine.applyMove(state, move('a1', 'a5', 'white'));

    expect(next.moveHistory[next.moveHistory.length - 1]?.notation).toBe('R1a5+');
  });

  it('records en passant captures with SAN capture notation', () => {
    let state = chessEngine.getInitialState();

    state = chessEngine.applyMove(state, move('e2', 'e4', 'white'));
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    state = chessEngine.applyMove(state, move('e4', 'e5', 'white'));
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    state = chessEngine.applyMove(state, move('e5', 'd6', 'white', { isEnPassant: true }));

    expect(state.moveHistory[state.moveHistory.length - 1]?.notation).toBe('exd6');
  });

  it('validates against the effective onPreMoveApply result, not just the raw move', () => {
    const redirectModifier: ModifierDefinition = {
      id: 'TEST-PRE-MOVE-APPLY',
      name: 'Redirect',
      category: 'C',
      pointCost: 0,
      curseRating: 0,
      activeFor: 'both',
      onPreMoveApply(state, mv) {
        if (mv.from === 'e2' && mv.to === 'e3') {
          return {
            state,
            move: {
              ...mv,
              to: 'f2',
            },
          };
        }
        return { state, move: mv };
      },
    };

    modifierRegistry.register(redirectModifier);

    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'e2'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);

    state.activeModifiers = [
      {
        id: redirectModifier.id,
        name: redirectModifier.name,
        activeFor: 'both',
        sourceColor: null,
      },
    ];

    expect(chessEngine.validateMove(state, move('e2', 'e3', 'white'))).toEqual({
      valid: false,
      reason: 'leaves king in check',
    });
  });

  it('applies the effective onPreMoveApply move and fires onMatchEnd on terminal results', () => {
    let matchEndCalls = 0;
    let finalStatus: GameState['status'] | null = null;

    const pipelineModifier: ModifierDefinition = {
      id: 'TEST-PIPELINE-HOOKS',
      name: 'Pipeline Hooks',
      category: 'C',
      pointCost: 0,
      curseRating: 0,
      activeFor: 'both',
      onPreMoveApply(state, mv) {
        if (mv.from === 'e2' && mv.to === 'e3') {
          return {
            state,
            move: {
              ...mv,
              to: 'e4',
            },
          };
        }
        return { state, move: mv };
      },
      onMatchEnd(state) {
        matchEndCalls += 1;
        finalStatus = state.status;
      },
    };

    modifierRegistry.register(pipelineModifier);

    const redirectedState = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'e8'),
      makePiece('pawn', 'white', 'e2'),
    ]);

    redirectedState.activeModifiers = [
      {
        id: pipelineModifier.id,
        name: pipelineModifier.name,
        activeFor: 'both',
        sourceColor: null,
      },
    ];

    const redirectedNext = chessEngine.applyMove(
      redirectedState,
      move('e2', 'e3', 'white'),
    );

    expect(redirectedNext.pieces.has('e3')).toBe(false);
    expect(redirectedNext.pieces.get('e4')).toMatchObject({
      type: 'pawn',
      color: 'white',
    });
    expect(redirectedNext.moveHistory[0]?.move.to).toBe('e4');

    let terminalState = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('king', 'black', 'e8'),
    ]);

    terminalState.activeModifiers = [
      {
        id: pipelineModifier.id,
        name: pipelineModifier.name,
        activeFor: 'both',
        sourceColor: null,
      },
    ];

    terminalState = chessEngine.passTurn(terminalState);

    expect(terminalState.status).toBe('draw');
    expect(matchEndCalls).toBe(1);
    expect(finalStatus).toBe('draw');
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
      message: 'white rook on a4 burns in lava.',
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

  it('scopes conscientious objector to the drafting side', () => {
    const state = chessEngine.activateDraftModifiers(
      chessEngine.getInitialState(),
      [{ id: 'MOD-B007', sourceColor: 'black' }],
    );

    const pacifists = Array.from(state.pieces.values()).filter(piece => piece.isPacifist);

    expect(pacifists).toHaveLength(1);
    expect(pacifists[0].color).toBe('black');
  });

  it('allows both sides to draft owned modifiers like berserker', () => {
    const state = chessEngine.activateDraftModifiers(
      chessEngine.getInitialState(),
      [
        { id: 'MOD-E006', sourceColor: 'white' },
        { id: 'MOD-E006', sourceColor: 'black' },
      ],
    );

    const berserkers = Array.from(state.pieces.values()).filter(piece => piece.isBerserker);
    const colors = berserkers.map(piece => piece.color).sort();

    expect(berserkers).toHaveLength(2);
    expect(colors).toEqual(['black', 'white']);
  });

  it('scopes gerald to the drafting side turn', () => {
    let state = chessEngine.activateDraftModifiers(
      chessEngine.getInitialState(),
      [{ id: 'MOD-B002', sourceColor: 'black' }],
    );

    state = chessEngine.beginTurn(state);
    const whiteBlockedPieces = Array.from(state.pieces.values()).filter(
      piece => (piece.cooldowns['MOD-B002'] ?? 0) > 0,
    );
    expect(whiteBlockedPieces).toHaveLength(0);

    state = chessEngine.passTurn(state);
    const blackBlockedPieces = Array.from(state.pieces.values()).filter(
      piece => piece.color === 'black' && (piece.cooldowns['MOD-B002'] ?? 0) > 0,
    );
    expect(blackBlockedPieces).toHaveLength(1);
  });

  it('keeps Gerald on the same piece for two turns before rerolling', () => {
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

    const firstBlocked = Array.from(state.pieces.values()).find(
      piece => piece.color === 'white' && (piece.cooldowns['MOD-B002'] ?? 0) > 0,
    );
    expect(firstBlocked).toBeDefined();
    expect(firstBlocked?.cooldowns['MOD-B002']).toBe(2);

    state = chessEngine.passTurn(state);
    state = chessEngine.passTurn(state);

    const secondBlocked = Array.from(state.pieces.values()).find(
      piece => piece.color === 'white' && (piece.cooldowns['MOD-B002'] ?? 0) > 0,
    );
    expect(secondBlocked?.id).toBe(firstBlocked?.id);
    expect(secondBlocked?.cooldowns['MOD-B002']).toBe(1);
  });

  it('rotates lava every three turns', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('king', 'black', 'e8'),
      ]),
      [{ id: 'MOD-A002', sourceColor: 'white' }],
    );

    state.prngState = 7;
    const initialLavaSquares = Array.from(state.tiles.keys()).sort();

    state.turnNumber = 3;
    state = chessEngine.beginTurn(state);

    const rotatedLavaSquares = Array.from(state.tiles.keys()).sort();
    expect(rotatedLavaSquares).not.toEqual(initialLavaSquares);
    expect(rotatedLavaSquares).toHaveLength(4);
  });
});
