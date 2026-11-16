import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import type { GameState, Piece, Square } from '../engine/types';
import { getValidOptions } from '../draft/rules';
import './index';
import { MODIFIER_IDS } from './ids';
import { RUN_COOLDOWN } from './definitions/run-forrest-run';
import { makeEmptyState, makePiece, move } from './testHelpers';

const RUN = MODIFIER_IDS.runForrestRun;

function withRun(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: RUN, sourceColor: 'white' }, ...extra]);
}

function runTargets(state: GameState, square: Square): Square[] {
  return [...(getAbilityOptions(state, square).find(option => option.modifierId === RUN)?.targets ?? [])].sort();
}

describe('MOD-C014 Run, Forrest, Run', () => {
  it('runs the King two squares in any straight line', () => {
    const state = withRun([makePiece('king', 'white', 'd4'), makePiece('king', 'black', 'h8')]);
    expect(runTargets(state, 'd4')).toEqual(['b2', 'b4', 'b6', 'd2', 'd6', 'f2', 'f4', 'f6']);

    const next = chessEngine.applyMove(state, move('d4', 'd6', 'white', { ability: RUN }));
    expect(next.pieces.get('d6')).toMatchObject({ type: 'king', color: 'white' });
    expect(next.pieces.has('d4')).toBe(false);
    expect(next.turn).toBe('black');
    expect(next.moveHistory[0].notation).toBe('Kd4-d6');
    expect(next.eventHistory[next.eventHistory.length - 1]).toMatchObject({ modifierId: RUN, title: 'RUN, FORREST, RUN' });
  });

  it('needs both squares empty and never captures', () => {
    const state = withRun([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'a2'),
      makePiece('knight', 'black', 'c1'),
      makePiece('king', 'black', 'h8'),
    ]);
    // a-file blocked at a2, rank blocked at c1, diagonal open.
    expect(runTargets(state, 'a1')).toEqual(['c3']);
    expect(chessEngine.validateMove(state, move('a1', 'c1', 'white', { ability: RUN })).valid).toBe(false);
  });

  it('may not run through an attacked square', () => {
    // The black rook on b8 covers b1 and b2, so only the a-file run is left.
    const state = withRun([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'black', 'b8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(runTargets(state, 'a1')).toEqual(['a3']);
  });

  it('may not end in check', () => {
    const state = withRun([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'black', 'h3'),
      makePiece('king', 'black', 'h8'),
    ]);
    // a3 and c3 lie on the rook's rank.
    expect(runTargets(state, 'a1')).toEqual(['c1']);
    expect(chessEngine.validateMove(state, move('a1', 'a3', 'white', { ability: RUN })).valid).toBe(false);
  });

  it('may run out of check, never along the checking line', () => {
    const state = withRun([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(runTargets(state, 'e1')).toEqual(['c1', 'c3', 'g1', 'g3']);
  });

  it('ends castling rights and waits 10 own turns', () => {
    let state = withRun([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.flags.castlingRights.white = { kingSide: true, queenSide: false };
    state = chessEngine.applyMove(state, move('e1', 'e3', 'white', { ability: RUN }));
    expect(state.flags.castlingRights.white.kingSide).toBe(false);
    for (let turn = 1; turn <= RUN_COOLDOWN; turn++) {
      state.positionHistory = {}; // shuffling kings would repeat into a draw
      state = chessEngine.applyMove(state, move(turn % 2 ? 'a8' : 'b8', turn % 2 ? 'b8' : 'a8', 'black'));
      expect(getAbilityOptions(state, 'e3').find(o => o.modifierId === RUN)?.cooldownLeft).toBeGreaterThan(0);
      expect(chessEngine.validateMove(state, move('e3', 'e5', 'white', { ability: RUN })).valid).toBe(false);
      state = chessEngine.applyMove(state, move(turn % 2 ? 'h1' : 'h2', turn % 2 ? 'h2' : 'h1', 'white'));
    }
    state = chessEngine.applyMove(state, move('a8', 'b8', 'black'));
    expect(runTargets(state, 'e3')).toContain('e5');
  });

  it('is only offered to the owner', () => {
    const state = withRun([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'e5')]);
    state.turn = 'black';
    expect(getAbilityOptions(state, 'e5')).toEqual([]);
    expect(chessEngine.validateMove(state, move('e5', 'e7', 'black', { ability: RUN })).valid).toBe(false);
  });

  it('cannot run into or across the storm', () => {
    let state = withRun(
      [makePiece('king', 'white', 'c3'), makePiece('king', 'black', 'h8')],
      [{ id: MODIFIER_IDS.stormClosesIn, sourceColor: 'white' }],
    );
    const tile = state.tiles.get('a1') ?? { square: 'a1' as Square, effects: [] };
    state = { ...state, tiles: new Map(state.tiles).set('a1', { ...tile, isVoid: true }) };
    expect(runTargets(state, 'c3')).not.toContain('a1');
    expect(runTargets(state, 'c3')).toContain('a3');
    const tileB = state.tiles.get('b3') ?? { square: 'b3' as Square, effects: [] };
    state = { ...state, tiles: new Map(state.tiles).set('b3', { ...tileB, isVoid: true }) };
    expect(runTargets(state, 'c3')).not.toContain('a3');
    expect(runTargets(state, 'c3')).toContain('c1');
  });

  it('cannot run while slowed by infection', () => {
    const state = withRun([makePiece('king', 'white', 'd4', 'runner'), makePiece('king', 'black', 'h8')]);
    state.activeModifiers.push({ id: MODIFIER_IDS.cordycepticSpread, name: 'The Cordyceptic Spread', activeFor: 'both', sourceColor: null });
    state.tiles.set('d4', { square: 'd4', effects: [{ type: 'infected', turnsRemaining: -1 }] });
    expect(runTargets(state, 'd4')).toContain('d6');
    state.modifierState[MODIFIER_IDS.cordycepticSpread] = { rot: { runner: 1 } };
    expect(runTargets(state, 'd4')).toEqual([]);
    expect(chessEngine.validateMove(state, move('d4', 'd6', 'white', { ability: RUN })).valid).toBe(false);
  });

  it('cannot be drafted by the same side as Heavy Is The Crown', () => {
    const all = new Set<string>([RUN, MODIFIER_IDS.heavyIsTheCrown]);
    const ids = (own: string[]) => getValidOptions(own, [], all, { unlimited: true }).map(card => card.id);
    expect(ids([MODIFIER_IDS.heavyIsTheCrown])).not.toContain(RUN);
    expect(ids([RUN])).not.toContain(MODIFIER_IDS.heavyIsTheCrown);
    expect(getValidOptions([], [MODIFIER_IDS.heavyIsTheCrown], all).map(card => card.id)).toContain(RUN);
  });
});
