import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import { getAbilityOptions } from '../engine/abilities';
import './index';
import { MODIFIER_IDS } from './ids';
import { bulletTimePath } from './definitions/bullet-time';
import { isFlooded } from './definitions/tide';
import { getHiddenPieceIds } from '../engine/visibility';
import { getValidOptions } from '../draft/rules';
import { modifierRegistry } from './registry';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.bulletTime;

function start(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: ID, sourceColor: 'white' }, ...extra]));
}

const bt = (from: string, to: string) => move(from as never, to as never, 'white', { ability: ID });
const targets = (state: GameState, sq: string) => getAbilityOptions(state, sq as never).find(o => o.modifierId === ID)?.targets ?? [];

describe('MOD-C016 Bullet Time', () => {
  it('a knight jumps twice in one move, then cools down', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b1')]);
    expect(targets(state, 'b1')).toContain('e4');
    expect(chessEngine.validateMove(state, bt('b1', 'e4')).valid).toBe(true);
    state = chessEngine.applyMove(state, bt('b1', 'e4'));
    expect(state.pieces.get('e4')).toMatchObject({ type: 'knight', color: 'white' });
    expect(state.turn).toBe('black');
    expect(state.moveHistory[state.moveHistory.length - 1].notation).toMatch(/^Nb1-(c3|d2)-e4/);
    expect(state.pieces.get('e4')?.abilityCooldowns?.[ID]).toBeGreaterThan(0);
  });

  it('the second jump can capture; the first cannot', () => {
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b1'),
      makePiece('pawn', 'black', 'c3'), makePiece('pawn', 'black', 'd2'), makePiece('rook', 'black', 'a3'), makePiece('bishop', 'black', 'e4')]);
    // Both first jumps from b1 (c3, d2) hold black pawns; a3 holds a rook: no first jump at all.
    expect(targets(state, 'b1')).toEqual([]);
    const open = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b1'), makePiece('bishop', 'black', 'e4')]);
    expect(targets(open, 'b1')).toContain('e4');
    const next = chessEngine.applyMove(open, bt('b1', 'e4'));
    expect(next.pieces.get('e4')).toMatchObject({ type: 'knight', color: 'white' });
  });

  it('the first jump cannot give check', () => {
    // Black King on e5: a first jump to f3 would check it.
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'e5'), makePiece('knight', 'white', 'g1')]);
    expect(bulletTimePath(state, 'g1', 'e1')).toBeNull(); // only via f3, which checks e5
    expect(targets(state, 'g1')).not.toContain('e1');
  });

  it('the first jump cannot leave its own King in check', () => {
    // Knight on d2 pinned by the rook on d8 to the King on d1: every first jump leaves the d-file.
    const state = start([makePiece('king', 'white', 'd1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'd2'), makePiece('rook', 'black', 'd8')]);
    expect(targets(state, 'd2')).toEqual([]);
  });

  it('may give check with the second jump, and the King is never a target', () => {
    const state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'c4')]);
    // c4 -> e5 -> g6 checks h8.
    expect(targets(state, 'c4')).toContain('g6');
    const next = chessEngine.applyMove(state, bt('c4', 'g6'));
    expect(chessEngine.isInCheck(next, 'black')).toBe(true);
    const near = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'f7'), makePiece('knight', 'white', 'c4')]);
    expect(targets(near, 'c4')).not.toContain('f7');
  });

  it('one side cannot hold it with a card that replaces the knights', () => {
    const ids = new Set(modifierRegistry.getAll().map(d => d.id));
    expect(getValidOptions([MODIFIER_IDS.knightRider], [], ids).some(c => c.id === ID)).toBe(false);
    expect(getValidOptions([], [MODIFIER_IDS.knightRider], ids).some(c => c.id === ID)).toBe(true);
  });

  it('interaction: Tide Goes In. A knight may still stop on the water', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b1')], [{ id: MODIFIER_IDS.tideGoesIn, sourceColor: 'black' }]);
    state = { ...state, flags: { ...state.flags, fullMoveNumber: 9 } };
    state = chessEngine.beginTurn(state);
    expect(isFlooded(state)).toBe(true);
    expect(chessEngine.validateMove(state, bt('b1', 'e4')).valid).toBe(true);
  });
  it('never stands on a void square, first jump or last', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b1')]);
    state.tiles.set('c3', { square: 'c3', effects: [], isVoid: true });
    state.tiles.set('f3', { square: 'f3', effects: [], isVoid: true });
    expect(bulletTimePath(state, 'b1', 'e4')).toBe('d2');
    expect(targets(state, 'b1')).not.toContain('f3');
    expect(targets(state, 'b1')).not.toContain('c3');
  });

  it('a hidden enemy piece on the first jump turns the move into a bump', () => {
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b1'), makePiece('bishop', 'black', 'c3')],
      [{ id: MODIFIER_IDS.invisibilityCloak, sourceColor: 'black' }]);
    state = { ...state, modifierState: { ...state.modifierState, [MODIFIER_IDS.invisibilityCloak]: { black: { pieceId: 'black-bishop-c3' } } } };
    expect(getHiddenPieceIds(state, 'white').has('black-bishop-c3')).toBe(true);
    // White sees c3 as empty and picks it; on the real board the jump fails.
    expect(bulletTimePath(state, 'b1', 'e4')).toBeNull();
    expect(chessEngine.validateMove(state, bt('b1', 'e4')).bump).toBe(true);
    const next = chessEngine.applyMove(state, bt('b1', 'e4'));
    expect(next.turn).toBe('white');
    expect(next.pieces.get('b1')).toMatchObject({ type: 'knight' });
  });
});
