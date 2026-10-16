import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { getChickBotMove } from '../engine/bot';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const OOPS = MODIFIER_IDS.didIDoThat;
const SWIPE = MODIFIER_IDS.retaliatorySwipe;
const CANNON = MODIFIER_IDS.forTheEmperor;

function withCard(pieces: Piece[], id: string, owner: 'white' | 'black' = 'white'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id, sourceColor: owner }],
  );
}

describe('active abilities', () => {
  it('lists ability targets for the selected piece', () => {
    const state = withCard([makePiece('knight', 'white', 'b1'), makePiece('pawn', 'black', 'b5')], OOPS);
    const [option] = getAbilityOptions(state, 'b1');
    expect(option).toMatchObject({ modifierId: OOPS, cooldownLeft: 0 });
    expect(option.targets).toEqual(expect.arrayContaining(['b2', 'b5', 'a1', 'd1']));
    expect(option.targets).not.toContain('b6');
  });

  it('is only offered to the owner', () => {
    const state = withCard([makePiece('knight', 'black', 'b8')], OOPS, 'white');
    state.turn = 'black';
    expect(getAbilityOptions(state, 'b8')).toEqual([]);
    expect(chessEngine.validateMove(state, move('b8', 'b5', 'black', { ability: OOPS })).valid).toBe(false);
  });

  it('plays the move, costs the turn, and cools down for 6 own turns', () => {
    let state = withCard(
      [makePiece('knight', 'white', 'b1'), makePiece('pawn', 'black', 'b5'), makePiece('rook', 'black', 'h8')],
      OOPS,
    );
    state = chessEngine.applyMove(state, move('b1', 'b5', 'white', { ability: OOPS }));
    expect(state.pieces.get('b5')).toMatchObject({ type: 'knight', color: 'white' });
    expect(state.turn).toBe('black');
    expect(state.moveHistory[0].notation).toBe('Nb1xb5');

    for (let turn = 1; turn <= 6; turn++) {
      // The black rook walks down the h-file so no position repeats.
      state = chessEngine.applyMove(state, move(`h${9 - turn}` as Square, `h${8 - turn}` as Square, 'black'));
      expect(getAbilityOptions(state, 'b5')[0].cooldownLeft).toBeGreaterThan(0);
      state = chessEngine.applyMove(state, move(turn % 2 ? 'e1' : 'd1', turn % 2 ? 'd1' : 'e1', 'white'));
    }
    state = chessEngine.applyMove(state, move('h2', 'g2', 'black'));
    expect(getAbilityOptions(state, 'b5')[0].cooldownLeft).toBe(0);
  });

  it('refuses an ability that leaves the king in check', () => {
    const state = withCard([makePiece('knight', 'white', 'e2'), makePiece('rook', 'black', 'e7')], OOPS);
    expect(chessEngine.validateMove(state, move('e2', 'a2', 'white', { ability: OOPS }))).toEqual({
      valid: false,
      reason: 'leaves king in check',
    });
    expect(chessEngine.validateMove(state, move('e2', 'e7', 'white', { ability: OOPS })).valid).toBe(true);
  });

  it('is blocked by Gerald like any other move', () => {
    const state = withCard([makePiece('knight', 'white', 'b1')], OOPS);
    state.pieces.set('b1', { ...state.pieces.get('b1')!, cooldowns: { [MODIFIER_IDS.gerald]: 2 } });
    state.activeModifiers.push({ id: MODIFIER_IDS.gerald, name: 'Gerald', activeFor: 'both', sourceColor: 'white' });
    expect(chessEngine.validateMove(state, move('b1', 'b4', 'white', { ability: OOPS })).valid).toBe(false);
  });

  it('knight rook-moves cannot start in the Swamp', () => {
    let state = withCard([makePiece('knight', 'white', 'd4')], OOPS);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: null }]);
    expect(chessEngine.validateMove(state, move('d4', 'a4', 'white', { ability: OOPS })).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d4', 'c4', 'white', { ability: OOPS })).valid).toBe(true);
  });
});

describe('MOD-C004 Retaliatory Swipe', () => {
  it('captures diagonally backwards only onto enemy pieces', () => {
    const state = withCard(
      [makePiece('pawn', 'white', 'd4'), makePiece('bishop', 'black', 'c3'), makePiece('pawn', 'white', 'e3')],
      SWIPE,
    );
    expect(getAbilityOptions(state, 'd4')[0].targets).toEqual(['c3']);
    const next = chessEngine.applyMove(state, move('d4', 'c3', 'white', { ability: SWIPE }));
    expect(next.pieces.get('c3')).toMatchObject({ type: 'pawn', color: 'white' });
  });

  it('a pacifist pawn will not swipe', () => {
    const state = withCard([makePiece('pawn', 'white', 'd4'), makePiece('bishop', 'black', 'c3')], SWIPE);
    state.pieces.set('d4', { ...state.pieces.get('d4')!, isPacifist: true });
    state.activeModifiers.push({ id: MODIFIER_IDS.conscientiousObjector, name: 'CO', activeFor: 'both', sourceColor: 'white' });
    expect(getAbilityOptions(state, 'd4')[0].targets).toEqual([]);
  });
});

describe('MOD-C006 FOR THE EMPEROR', () => {
  it('hits the first piece in each line, either colour, never a king', () => {
    const state = withCard(
      [makePiece('rook', 'white', 'a4'), makePiece('pawn', 'white', 'a6'), makePiece('knight', 'black', 'f4'), makePiece('pawn', 'black', 'g4')],
      CANNON,
    );
    state.pieces.set('a2', makePiece('king', 'black', 'a2'));
    state.pieces.delete('e8');
    expect(getAbilityOptions(state, 'a4')[0].targets.sort()).toEqual(['a6', 'f4']);
  });

  it('destroys the target and the rook stays put', () => {
    const state = withCard([makePiece('rook', 'white', 'a4'), makePiece('queen', 'black', 'f4')], CANNON);
    const next = chessEngine.applyMove(state, move('a4', 'f4', 'white', { ability: CANNON }));
    expect(next.pieces.get('a4')?.type).toBe('rook');
    expect(next.pieces.has('f4')).toBe(false);
    expect(next.moveHistory[0].notation).toBe('Ra4*f4');
    expect(next.moveHistory[0].pieceCaptured?.type).toBe('queen');
    expect(next.eventHistory[next.eventHistory.length - 1]?.modifierId).toBe(CANNON);
  });

  it('the bot fires when it wins material', () => {
    // The black rook is pinned on rank 4, so only the cannon can reach the queen.
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'a1'),
        makePiece('rook', 'white', 'a4'),
        makePiece('queen', 'white', 'e1'),
        makePiece('rook', 'black', 'e4'),
        makePiece('king', 'black', 'h4'),
      ]),
      [{ id: CANNON, sourceColor: 'black' }],
    );
    state.turn = 'black';
    expect(getChickBotMove(state, 'black')).toMatchObject({ from: 'e4', to: 'e1', ability: CANNON });
  });
});
