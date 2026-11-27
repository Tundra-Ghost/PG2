import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import { getAbilityOptions } from '../engine/abilities';
import './index';
import { MODIFIER_IDS } from './ids';
import { BRIBE_COOLDOWN } from './definitions/everyone-has-a-price';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.everyoneHasAPrice;

function start(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: ID, sourceColor: 'white' }, ...extra]));
}

const bribe = (from: string, to: string) => move(from as never, to as never, 'white', { ability: ID });
const targets = (state: GameState, sq: string) => getAbilityOptions(state, sq as never).find(o => o.modifierId === ID)?.targets ?? [];

describe('MOD-C019 Everyone Has A Price', () => {
  it('an adjacent enemy pawn on its own half joins the Queen, using the move', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('queen', 'white', 'd5'), makePiece('pawn', 'black', 'e6')]);
    expect(targets(state, 'd5')).toEqual(['e6']);
    state = chessEngine.applyMove(state, bribe('d5', 'e6'));
    expect(state.pieces.get('e6')).toMatchObject({ type: 'pawn', color: 'white', id: 'black-pawn-e6' });
    expect(state.pieces.get('d5')).toMatchObject({ type: 'queen', color: 'white' });
    expect(state.turn).toBe('black');
    expect(state.pieces.get('d5')?.abilityCooldowns?.[ID]).toBe(BRIBE_COOLDOWN);
    expect(state.moveHistory[state.moveHistory.length - 1].notation).toBe('Qd5$e6');
    // The bribed pawn now moves as a white pawn.
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(chessEngine.validateMove(state, move('e6', 'e7', 'white')).valid).toBe(true);
  });

  it('only pawns on their own half, never one a step from promoting for its new side', () => {
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h7'), makePiece('queen', 'white', 'd4'),
      makePiece('pawn', 'black', 'c5'), makePiece('pawn', 'black', 'e3'), makePiece('knight', 'black', 'd5')]);
    expect(targets(state, 'd4')).toEqual(['c5']);
    const deep = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('queen', 'white', 'd6'), makePiece('pawn', 'black', 'd7')]);
    expect(targets(deep, 'd6')).toEqual([]);
    expect(chessEngine.validateMove(deep, bribe('d6', 'd7')).valid).toBe(false);
  });

  it('a bribed pawn may not give check on the move it changes sides', () => {
    // A white pawn on e6 would attack the black King on f7.
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'f7'), makePiece('queen', 'white', 'd5'), makePiece('pawn', 'black', 'e6')]);
    expect(targets(state, 'd5')).toEqual([]);
    expect(chessEngine.validateMove(state, bribe('d5', 'e6')).valid).toBe(false);
  });

  it('cannot leave your own King in check', () => {
    // The Queen is pinned on the e-file; the bribe does not move her, so it is legal only while not in check.
    const inCheck = start([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'black', 'e8'), makePiece('queen', 'white', 'd5'), makePiece('pawn', 'black', 'c6')]);
    expect(targets(inCheck, 'd5')).toEqual([]);
  });

  it('a Sus piece shown as something else is not offered', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('queen', 'white', 'd5'), makePiece('pawn', 'black', 'e6')],
      [{ id: MODIFIER_IDS.sus, sourceColor: 'black' }]);
    // Sus picked the pawn (the only non-King black piece) and shows it as another type.
    expect(targets(state, 'd5')).toEqual([]);
    state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('queen', 'white', 'd5'), makePiece('pawn', 'black', 'e6')]);
    expect(targets(state, 'd5')).toEqual(['e6']);
  });

  it('with Zerg Rush the briber may not buy a pawn that could double-step to promote', () => {
    const pieces = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('queen', 'white', 'd5'),
      makePiece('pawn', 'black', 'c6'), makePiece('pawn', 'black', 'e5')];
    expect(targets(start(pieces()), 'd5').sort()).toEqual(['c6', 'e5']);
    const zerg = start(pieces(), [{ id: MODIFIER_IDS.zergRush, sourceColor: 'white' }]);
    expect(targets(zerg, 'd5')).toEqual(['e5']);
  });

  it('a Shell Game cup and a hidden pawn are refused', () => {
    const pieces = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('queen', 'white', 'd5'), makePiece('pawn', 'black', 'e6')];
    const cup = start(pieces());
    cup.modifierState = { ...cup.modifierState, [MODIFIER_IDS.shellGame]: { black: [{ pieceId: 'black-pawn-e6', square: 'e6' }] } };
    cup.activeModifiers = [...cup.activeModifiers, { id: MODIFIER_IDS.shellGame, name: 'Shell Game', activeFor: 'black', sourceColor: 'black' }];
    expect(targets(cup, 'd5')).toEqual([]);
    const hidden = start(pieces());
    hidden.modifierState = { ...hidden.modifierState, [MODIFIER_IDS.invisibilityCloak]: { black: { pieceId: 'black-pawn-e6', until: 99 } } };
    hidden.activeModifiers = [...hidden.activeModifiers, { id: MODIFIER_IDS.invisibilityCloak, name: 'Invisibility Cloak', activeFor: 'black', sourceColor: 'black' }];
    expect(targets(hidden, 'd5')).toEqual([]);
    expect(chessEngine.validateMove(hidden, bribe('d5', 'e6')).valid).toBe(false);
  });

  it('waits 12 turns, resets the 50-move clock and clears en passant', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('queen', 'white', 'd5'), makePiece('pawn', 'black', 'e6')]);
    state.flags.halfMoveClock = 30;
    state.flags.enPassantSquare = 'c6';
    state = chessEngine.applyMove(state, bribe('d5', 'e6'));
    expect(state.flags.halfMoveClock).toBe(0);
    expect(state.flags.enPassantSquare).toBeNull();
    const options = (s: GameState) => ({ cooldownLeft: s.pieces.get('d5')?.abilityCooldowns?.[ID] ?? 0, status: s.status });
    for (let i = 0; i < BRIBE_COOLDOWN; i++) {
      state.positionHistory = {}; // no threefold draw while the King shuffles
      state = chessEngine.applyMove(state, move(i % 2 ? 'g8' : 'h8', i % 2 ? 'h8' : 'g8', 'black'));
      if (i < BRIBE_COOLDOWN - 1) expect(options(state).cooldownLeft).toBeGreaterThan(0);
      state = chessEngine.applyMove(state, move(i % 2 ? 'b1' : 'a1', i % 2 ? 'a1' : 'b1', 'white'));
    }
    state.positionHistory = {};
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(options(state)).toEqual({ cooldownLeft: 0, status: 'active' });
  });
});
