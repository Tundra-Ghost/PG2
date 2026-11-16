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
import { LEAP_COOLDOWN } from './definitions/leap-of-faith';
import { makeEmptyState, makePiece, move } from './testHelpers';

const LEAP = MODIFIER_IDS.leapOfFaith;

function withLeap(pieces: Piece[], extra: { id: string; sourceColor: Color }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: LEAP, sourceColor: 'white' }, ...extra]);
}

function leapTargets(state: GameState, square: Square): Square[] {
  return [...(getAbilityOptions(state, square).find(option => option.modifierId === LEAP)?.targets ?? [])].sort();
}

describe('MOD-C010 Leap Of Faith', () => {
  it('jumps the first piece on each diagonal onto the empty square behind it', () => {
    const state = withLeap([
      makePiece('king', 'white', 'h1'),
      makePiece('bishop', 'white', 'd4'),
      makePiece('pawn', 'white', 'e5'), // -> f6
      makePiece('knight', 'black', 'b6'), // far: c5 is empty, first piece b6 -> a7
      makePiece('pawn', 'black', 'c3'), // -> b2 holds a piece: no leap
      makePiece('rook', 'white', 'b2'),
      makePiece('king', 'black', 'h8'),
    ]);
    // Down-right (e3, f2, g1) has no piece, so no leap that way.
    expect(leapTargets(state, 'd4')).toEqual(['a7', 'f6']);
    const next = chessEngine.applyMove(state, move('d4', 'a7', 'white', { ability: LEAP }));
    expect(next.pieces.get('a7')).toMatchObject({ type: 'bishop', color: 'white' });
    expect(next.pieces.get('b6')).toMatchObject({ type: 'knight', color: 'black' });
    expect(next.pieces.has('d4')).toBe(false);
    expect(next.turn).toBe('black');
    expect(next.moveHistory[0].notation).toMatch(/^Bd4↷a7/);
    expect(next.pieces.get('a7')!.abilityCooldowns?.[LEAP]).toBe(LEAP_COOLDOWN);
  });

  it('never captures and never lands on an occupied square', () => {
    const state = withLeap([
      makePiece('king', 'white', 'h1'),
      makePiece('bishop', 'white', 'c1'),
      makePiece('pawn', 'black', 'd2'),
      makePiece('queen', 'black', 'e3'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(leapTargets(state, 'c1')).toEqual([]);
    expect(chessEngine.validateMove(state, move('c1', 'e3', 'white', { ability: LEAP })).valid).toBe(false);
  });

  it('never leaps over a void square', () => {
    const state = withLeap([
      makePiece('king', 'white', 'h1'),
      makePiece('bishop', 'white', 'c1'),
      makePiece('pawn', 'black', 'e3'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(leapTargets(state, 'c1')).toEqual(['f4']);
    state.tiles.set('d2', { square: 'd2', effects: [], statue: true, isVoid: true });
    expect(leapTargets(state, 'c1')).toEqual([]);
  });

  it('a leap that leaves your King in check is not allowed', () => {
    const state = withLeap([
      makePiece('king', 'white', 'a1'),
      makePiece('bishop', 'white', 'c3'), // pinned on the long diagonal
      makePiece('pawn', 'white', 'd2'), // -> e1, off the pin line
      makePiece('queen', 'black', 'h8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(leapTargets(state, 'c3')).toEqual([]);
    expect(chessEngine.validateMove(state, move('c3', 'e1', 'white', { ability: LEAP })).valid).toBe(false);
    // Without the pin the same leap is fine.
    state.pieces.delete('h8');
    expect(leapTargets(state, 'c3')).toEqual(['e1']);
  });

  it('may leap into the line of a check to block it', () => {
    const state = withLeap([
      makePiece('king', 'white', 'e1'),
      makePiece('bishop', 'white', 'c1'),
      makePiece('pawn', 'white', 'd2'), // -> e3 blocks the e-file
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(leapTargets(state, 'c1')).toEqual(['e3']);
  });

  it('waits out its cooldown before leaping again', () => {
    let state = withLeap([
      makePiece('king', 'white', 'h1'),
      makePiece('bishop', 'white', 'c1'),
      makePiece('pawn', 'white', 'd2'),
      makePiece('pawn', 'white', 'f4'),
      makePiece('king', 'black', 'a8'),
    ]);
    state = chessEngine.applyMove(state, move('c1', 'e3', 'white', { ability: LEAP }));
    state = chessEngine.applyMove(state, move('a8', 'b8', 'black'));
    expect(leapTargets(state, 'e3')).toEqual([]);
    expect(chessEngine.validateMove(state, move('e3', 'g5', 'white', { ability: LEAP })).valid).toBe(false);
  });

  it('under fog, never offers a leap over a piece the owner cannot see', () => {
    const state = withLeap(
      [
        makePiece('king', 'white', 'h1'),
        makePiece('bishop', 'white', 'a1'),
        makePiece('pawn', 'black', 'f6'),
        makePiece('king', 'black', 'a8'),
      ],
      [{ id: MODIFIER_IDS.darkAndScared, sourceColor: 'white' }],
    );
    expect(leapTargets(state, 'a1')).toEqual([]);
  });

  it('Twin Telepathy: the twin bishop mirrors the leap as a normal slide', () => {
    const state = withLeap(
      [
        makePiece('king', 'white', 'h1'),
        makePiece('bishop', 'white', 'c1', 'b-one'),
        makePiece('pawn', 'white', 'd2'),
        makePiece('bishop', 'white', 'a5', 'b-two'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.twinTelepathy, sourceColor: 'white' }],
    );
    const next = chessEngine.applyMove(state, move('c1', 'e3', 'white', { ability: LEAP }));
    expect(next.pieces.get('e3')?.id).toBe('b-one');
    expect(next.pieces.get('c7')?.id).toBe('b-two');
  });

  it('bots may leap, and only legally', () => {
    const state = withLeap([
      makePiece('king', 'white', 'h1'),
      makePiece('bishop', 'white', 'c1'),
      makePiece('pawn', 'white', 'd2'),
      makePiece('king', 'black', 'h8'),
    ]);
    const leaps = listBotMoves(state, 'white').filter(m => m.ability === LEAP);
    expect(leaps).toEqual([{ from: 'c1', to: 'e3', playerColor: 'white', ability: LEAP }]);
    expect(chessEngine.validateMove(state, getChickBotMove(state, 'white', () => 0)!).valid).toBe(true);
  });

  it('cannot be drafted with The Small Council or Elephant In The Room on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === LEAP)!;
    for (const other of [MODIFIER_IDS.smallCouncil, MODIFIER_IDS.elephantInTheRoom]) {
      expect(pickBlocker(card, [other], [], built)).toMatch(/Does not work with/);
      expect(getValidOptions([], [other], built).map(c => c.id)).toContain(LEAP);
    }
  });
});
