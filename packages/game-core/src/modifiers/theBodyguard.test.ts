import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { getChickBotMove, listBotMoves } from '../engine/bot';
import type { Color, GameState, Piece, Square } from '../engine/types';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { touchPiece } from './definitions/commitment-issues';
import { makeEmptyState, makePiece, move } from './testHelpers';

const GUARD = MODIFIER_IDS.theBodyguard;

function withGuard(pieces: Piece[], extra: { id: string; sourceColor: Color }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: GUARD, sourceColor: 'white' }, ...extra]);
}

function swapTargets(state: GameState, square: Square): Square[] {
  return getAbilityOptions(state, square).find(option => option.modifierId === GUARD)?.targets ?? [];
}

describe('MOD-E017 The Bodyguard', () => {
  it('replaces the owner\'s g-pawn at the start', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: GUARD, sourceColor: 'black' }]);
    expect(state.pieces.get('g7')).toMatchObject({ type: 'bodyguard', color: 'black' });
    expect(state.pieces.get('g2')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(Array.from(state.pieces.values()).filter(p => p.type === 'bodyguard')).toHaveLength(1);
  });

  it('steps one square like a King and can be captured', () => {
    const state = withGuard([
      makePiece('king', 'white', 'a1'),
      makePiece('bodyguard', 'white', 'd4'),
      makePiece('knight', 'black', 'e5'),
      makePiece('knight', 'black', 'c6'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect([...chessEngine.getLegalMoves(state, 'd4')].sort()).toEqual(['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5']);
    state.turn = 'black';
    const taken = chessEngine.applyMove(state, move('c6', 'd4', 'black'));
    expect(taken.pieces.get('d4')).toMatchObject({ type: 'knight', color: 'black' });
    // Not a King: losing it does not end the game.
    expect(taken.status).toBe('active');
  });

  it('swaps places with the King next to it; the King counts as moved', () => {
    const state = withGuard([
      makePiece('king', 'white', 'e1'),
      makePiece('bodyguard', 'white', 'f2'),
      makePiece('rook', 'white', 'h1'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.flags.castlingRights.white = { kingSide: true, queenSide: true };
    expect(swapTargets(state, 'f2')).toEqual(['e1']);
    const next = chessEngine.applyMove(state, move('f2', 'e1', 'white', { ability: GUARD }));
    expect(next.pieces.get('f2')).toMatchObject({ type: 'king', color: 'white' });
    expect(next.pieces.get('e1')).toMatchObject({ type: 'bodyguard', color: 'white' });
    expect(next.flags.castlingRights.white).toEqual({ kingSide: false, queenSide: false });
    expect(next.turn).toBe('black');
    expect(next.moveHistory[0].notation).toMatch(/^Bgf2⇄Ke1/);
  });

  it('no swap when the King is not next to it', () => {
    const state = withGuard([
      makePiece('king', 'white', 'e1'),
      makePiece('bodyguard', 'white', 'g2'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(swapTargets(state, 'g2')).toEqual([]);
  });

  it('a swap may not leave the King in check', () => {
    const state = withGuard([
      makePiece('king', 'white', 'e1'),
      makePiece('bodyguard', 'white', 'f2'),
      makePiece('rook', 'black', 'f8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(swapTargets(state, 'f2')).toEqual([]);
    expect(chessEngine.validateMove(state, move('f2', 'e1', 'white', { ability: GUARD })).valid).toBe(false);
  });

  it('a swap out of check is allowed when it ends the check', () => {
    const state = withGuard([
      makePiece('king', 'white', 'e1'),
      makePiece('bodyguard', 'white', 'd2'),
      makePiece('rook', 'black', 'e8'),
      makePiece('rook', 'black', 'f8'),
      makePiece('rook', 'black', 'a1'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(swapTargets(state, 'd2')).toEqual(['e1']);
    const next = chessEngine.applyMove(state, move('d2', 'e1', 'white', { ability: GUARD }));
    expect(chessEngine.isInCheck(next, 'white')).toBe(false);
  });

  it('a King frozen by Winter cannot be swapped, and a King swapped into the cold freezes', () => {
    const frozen = withGuard(
      [makePiece('king', 'white', 'e1'), makePiece('bodyguard', 'white', 'f2'), makePiece('king', 'black', 'a8')],
      [{ id: MODIFIER_IDS.winterIsComing, sourceColor: null as unknown as Color }],
    );
    const king = frozen.pieces.get('e1')!;
    frozen.pieces.set('e1', { ...king, cooldowns: { [MODIFIER_IDS.winterIsComing]: 1 } });
    expect(swapTargets(frozen, 'f2')).toEqual([]);
    expect(chessEngine.validateMove(frozen, move('f2', 'e1', 'white', { ability: GUARD })).reason).toMatch(/frozen/);

    // King on e4 (warm), Bodyguard on e3 (cold rank): the King lands in the cold.
    const warm = withGuard(
      [makePiece('king', 'white', 'e4'), makePiece('bodyguard', 'white', 'e3'), makePiece('king', 'black', 'a8')],
      [{ id: MODIFIER_IDS.winterIsComing, sourceColor: null as unknown as Color }],
    );
    const next = chessEngine.applyMove(warm, move('e3', 'e4', 'white', { ability: GUARD }));
    expect(next.pieces.get('e3')?.type).toBe('king');
    expect(next.pieces.get('e3')?.cooldowns[MODIFIER_IDS.winterIsComing] ?? 0).toBeGreaterThan(0);
  });

  it('Commitment Issues: a touched Bodyguard may still swap, so it never softlocks', () => {
    const state = withGuard(
      [
        makePiece('king', 'white', 'a1'),
        makePiece('bodyguard', 'white', 'b1'),
        makePiece('pawn', 'white', 'a2'),
        makePiece('pawn', 'white', 'b2'),
        makePiece('pawn', 'white', 'c2'),
        makePiece('knight', 'white', 'c1'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.commitmentIssues, sourceColor: 'white' }],
    );
    const touched = touchPiece(state, 'b1');
    expect(touched.pieces.get('b1')?.isTouched).toBe(true);
    expect(chessEngine.validateMove(touched, move('b1', 'a1', 'white', { ability: GUARD })).valid).toBe(true);
    expect(swapTargets(touched, 'b1')).toEqual(['a1']);
  });

  it('Roll For Initiative: when the die says Bodyguard, the swap counts', () => {
    const state = withGuard(
      [
        makePiece('king', 'white', 'a1'),
        makePiece('bodyguard', 'white', 'b1'),
        makePiece('pawn', 'white', 'a2'),
        makePiece('pawn', 'white', 'b2'),
        makePiece('pawn', 'white', 'c2'),
        makePiece('knight', 'white', 'c1'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.rollForInitiative, sourceColor: 'white' }],
    );
    state.modifierState[MODIFIER_IDS.rollForInitiative] = { roll: { color: 'white', turnNumber: state.turnNumber, type: 'bodyguard' } };
    expect(chessEngine.validateMove(state, move('b1', 'a1', 'white', { ability: GUARD })).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('c1', 'd3', 'white')).valid).toBe(false);
  });

  it('bots may swap, and only legally', () => {
    const state = withGuard([
      makePiece('king', 'white', 'e1'),
      makePiece('bodyguard', 'white', 'f2'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(listBotMoves(state, 'white')).toContainEqual({ from: 'f2', to: 'e1', playerColor: 'white', ability: GUARD });
    expect(chessEngine.validateMove(state, getChickBotMove(state, 'white', () => 0)!).valid).toBe(true);
  });

  it('cannot be drafted with The Small Council or Heavy Is The Crown on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === GUARD)!;
    for (const other of [MODIFIER_IDS.smallCouncil, MODIFIER_IDS.heavyIsTheCrown]) {
      expect(pickBlocker(card, [other], [], built)).toMatch(/Does not work with/);
      expect(getValidOptions([], [other], built).map(c => c.id)).toContain(GUARD);
    }
  });
});
