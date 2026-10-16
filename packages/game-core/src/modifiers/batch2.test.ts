import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove } from '../engine/bot';
import { getValidPromotionTypes } from '../engine/gameLoop';
import type { GameState } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { TRAITOR_EARLIEST_TURN } from './definitions/traitor';
import { makeEmptyState, makePiece, move } from './testHelpers';

const REJECT = MODIFIER_IDS.rejectQueen;
const TRAITOR = MODIFIER_IDS.traitor;

describe('MOD-E007 Reject Queen, Embrace Knight', () => {
  function promotionState(): GameState {
    return chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'a1'),
        makePiece('pawn', 'white', 'b7'),
        makePiece('king', 'black', 'h1'),
        makePiece('rook', 'black', 'c8'),
        makePiece('pawn', 'black', 'h5'),
      ]),
      [{ id: REJECT, sourceColor: 'white' }],
    );
  }

  it('forbids queen promotion for the owner only', () => {
    const state = promotionState();
    expect(chessEngine.validateMove(state, move('b7', 'b8', 'white', { promotion: 'queen' }))).toEqual({
      valid: false,
      reason: 'Reject Queen: promote to a knight, bishop or rook.',
    });
    expect(getValidPromotionTypes(state, 'b7', 'b8')).toEqual(['rook', 'bishop', 'knight']);
  });

  it('counts underpromotion as a valid move and the bot uses it', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'b7'),
      makePiece('pawn', 'white', 'a2'),
      makePiece('pawn', 'black', 'a3'),
      makePiece('king', 'black', 'h1'),
      makePiece('pawn', 'black', 'h2'),
    ]);
    const owned = chessEngine.activateDraftModifiers(state, [{ id: REJECT, sourceColor: 'white' }]);
    expect(chessEngine.hasAnyValidMove(owned)).toBe(true);
    expect(getChickBotMove(owned, 'white')?.promotion).toBe('rook');
  });

  it('gives the promoted piece one chain capture on its next capture', () => {
    let state = promotionState();
    state.pieces.set('d8', makePiece('knight', 'black', 'd8'));
    state.pieces.delete('c8');
    state.pieces.set('d6', makePiece('pawn', 'black', 'd6'));

    state = chessEngine.applyMove(state, move('b7', 'b8', 'white', { promotion: 'rook' }));
    expect(state.pieces.get('b8')?.hasPromotionChain).toBe(true);
    state = chessEngine.applyMove(state, move('h5', 'h4', 'black'));

    // Rb8xd8, then chains d8xd6.
    state = chessEngine.applyMove(state, move('b8', 'd8', 'white'));
    expect(state.pieces.get('d6')).toMatchObject({ type: 'rook', color: 'white', hasPromotionChain: false });
    expect(state.pieces.has('d8')).toBe(false);
    expect(state.eventHistory[state.eventHistory.length - 1]?.modifierId).toBe(REJECT);
  });
});

describe('MOD-B006 They Were The Traitor', () => {
  function traitorState(): GameState {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('queen', 'white', 'd2'),
        makePiece('rook', 'white', 'h1'),
        makePiece('king', 'black', 'e8'),
        makePiece('rook', 'black', 'a8'),
      ]),
      [{ id: TRAITOR, sourceColor: 'white' }],
    );
    state.flags.castlingRights.white = { kingSide: true, queenSide: false };
    return state;
  }

  /** Runs white turn starts until a traitor is warned. */
  function warnTraitor(state: GameState): GameState {
    let next = state;
    for (let seed = 1; seed < 200; seed++) {
      next = { ...state, prngState: seed };
      next = chessEngine.beginTurn(next);
      if (Array.from(next.pieces.values()).some(p => p.isTraitor)) return next;
    }
    throw new Error('no traitor warned');
  }

  it('never fires before move 11', () => {
    const state = traitorState();
    for (let seed = 1; seed < 50; seed++) {
      const next = chessEngine.beginTurn({ ...state, prngState: seed });
      expect(Array.from(next.pieces.values()).some(p => p.isTraitor)).toBe(false);
    }
  });

  it('warns on the highest-value piece, then it defects on the owner next turn', () => {
    const base = traitorState();
    base.turnNumber = TRAITOR_EARLIEST_TURN;
    let state = warnTraitor(base);
    expect(state.pieces.get('d2')?.isTraitor).toBe(true);
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toContain('defects next turn');

    state = chessEngine.applyMove(state, move('e1', 'f1', 'white'));
    state = chessEngine.applyMove(state, move('a8', 'a7', 'black'));

    expect(state.pieces.get('d2')).toMatchObject({ type: 'queen', color: 'black', isTraitor: false });
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe(
      "White's queen was The Traitor. 2 pieces remain.",
    );
  });

  it('only defects once per match', () => {
    const base = traitorState();
    base.turnNumber = TRAITOR_EARLIEST_TURN;
    let state = warnTraitor(base);
    state = chessEngine.applyMove(state, move('h1', 'h2', 'white'));
    state = chessEngine.applyMove(state, move('a8', 'a7', 'black'));
    for (let i = 0; i < 10; i++) {
      state = chessEngine.applyMove(state, move(i % 2 ? 'h3' : 'h2', i % 2 ? 'h2' : 'h3', 'white'));
      state = chessEngine.applyMove(state, move(i % 2 ? 'a6' : 'a7', i % 2 ? 'a7' : 'a6', 'black'));
      if (state.status !== 'active') break;
    }
    expect(Array.from(state.pieces.values()).filter(p => p.color === 'white')).toHaveLength(2);
  });

  it('starts over if the traitor is captured before it defects', () => {
    const base = traitorState();
    base.turnNumber = TRAITOR_EARLIEST_TURN;
    base.pieces.set('d7', makePiece('rook', 'black', 'd7'));
    let state = warnTraitor(base);
    state = chessEngine.applyMove(state, move('h1', 'h2', 'white'));
    state = chessEngine.applyMove(state, move('d7', 'd2', 'black'));
    expect(state.pieces.get('d2')?.color).toBe('black');
    expect(Array.from(state.pieces.values()).some(p => p.isTraitor)).toBe(false);
    expect(state.modifierState[TRAITOR]).toMatchObject({ white: { phase: 'waiting' } });
  });

  it('a defecting home rook takes its castling right with it', () => {
    const base = traitorState();
    base.turnNumber = TRAITOR_EARLIEST_TURN;
    base.pieces.delete('d2');
    base.pieces.set('a2', makePiece('pawn', 'white', 'a2'));
    let state = warnTraitor(base);
    expect(state.pieces.get('h1')?.isTraitor).toBe(true);
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    expect(state.flags.castlingRights.white.kingSide).toBe(true);
    state = chessEngine.applyMove(state, move('a8', 'a7', 'black'));
    expect(state.pieces.get('h1')?.color).toBe('black');
    expect(state.flags.castlingRights.white.kingSide).toBe(false);
  });
});
