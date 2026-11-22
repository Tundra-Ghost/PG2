import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { MAX_WALLS, WALL_COOLDOWN } from './definitions/dirt-hut';
import { getValidOptions } from '../draft/rules';
import { makeEmptyState, makePiece, move } from './testHelpers';

const HUT = MODIFIER_IDS.dirtHut;

function withHut(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: HUT, sourceColor: 'white' }, ...extra]);
}

function wallTargets(state: GameState, square: Square): Square[] {
  return getAbilityOptions(state, square).find(option => option.modifierId === HUT)?.targets ?? [];
}

const build = (from: Square, to: Square, color: 'white' | 'black' = 'white') => move(from, to, color, { ability: HUT });

describe('MOD-C018 Dirt Hut', () => {
  it('builds a wall next to the rook that blocks landing and sliding', () => {
    const state = withHut([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('rook', 'black', 'h5'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(wallTargets(state, 'd4')).toHaveLength(8);
    const next = chessEngine.applyMove(state, build('d4', 'd5'));
    expect(next.tiles.get('d5')?.barrier).toMatchObject({ kind: 'wall', owner: 'white' });
    expect(next.pieces.get('d4')).toMatchObject({ type: 'rook', color: 'white' });
    expect(next.turn).toBe('black');
    expect(next.moveHistory[0].notation).toBe('Rd4 wall d5');
    // The black rook cannot land on the wall or slide through it.
    const blackRook = chessEngine.getLegalMoves(next, 'h5');
    expect(blackRook).toContain('e5');
    expect(blackRook).not.toContain('d5');
    expect(blackRook).not.toContain('c5');
    // The white rook waits.
    expect(next.pieces.get('d4')?.abilityCooldowns?.[HUT]).toBe(WALL_COOLDOWN);
  });

  it('crumbles after 4 rounds', () => {
    let state = withHut([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
    ]);
    state = chessEngine.applyMove(state, build('d4', 'd5'));
    const shuffle: [Square, Square][] = [['h8', 'g8'], ['a1', 'a2'], ['g8', 'h8'], ['a2', 'a1'], ['h8', 'g8'], ['a1', 'a2'], ['g8', 'h8']];
    for (const [i, [from, to]] of shuffle.entries()) {
      expect(state.tiles.get('d5')?.barrier, `ply ${i + 2}`).toBeDefined();
      state = chessEngine.applyMove(state, move(from, to, state.turn));
    }
    // 8 plies after it was built, at the owner's turn, the wall is gone.
    expect(state.turn).toBe('white');
    expect(state.tiles.get('d5')).toBeUndefined();
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toContain('crumbles');
  });

  it('stays up while it shields the waiting King from check', () => {
    let state = withHut([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('rook', 'white', 'e1'),
      makePiece('king', 'black', 'h7'),
    ]);
    state = chessEngine.applyMove(state, build('d4', 'e5'));
    // Black walks its King behind the wall on the e-file.
    const walk: [Square, Square, 'white' | 'black'][] = [
      ['h7', 'g8', 'black'], ['a1', 'a2', 'white'], ['g8', 'f8', 'black'], ['a2', 'a1', 'white'],
      ['f8', 'e8', 'black'], ['a1', 'a2', 'white'], ['e8', 'd8', 'black'],
    ];
    for (const [from, to, color] of walk.slice(0, 5)) state = chessEngine.applyMove(state, move(from, to, color));
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('e8', 'e7', 'black'));
    // White's turn, 8 plies after the build: the wall would crumble, but it shields e7.
    expect(state.turn).toBe('white');
    expect(state.tiles.get('e5')?.barrier).toBeDefined();
    expect(chessEngine.getLegalMoves(state, 'e1')).not.toContain('e7');
    // Once Black steps off the file, it crumbles at White's next turn.
    state = chessEngine.applyMove(state, move('a2', 'a1', 'white'));
    state = chessEngine.applyMove(state, move('e7', 'd7', 'black'));
    expect(state.tiles.get('e5')).toBeUndefined();
  });

  it('blocks a line of check', () => {
    const state = withHut([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'd3'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.turn = 'white';
    // e1 is in check from e8: a wall on e2 or e3 or e4 ends it.
    const targets = wallTargets(state, 'd3');
    expect(targets.sort()).toEqual(['e2', 'e3', 'e4']);
  });

  it('allows at most 2 walls per side', () => {
    let state = withHut([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('rook', 'white', 'f4'),
      makePiece('rook', 'white', 'h2'),
      makePiece('king', 'black', 'a8'),
    ]);
    state = chessEngine.applyMove(state, build('d4', 'd5'));
    state = chessEngine.applyMove(state, move('a8', 'b8', 'black'));
    state = chessEngine.applyMove(state, build('f4', 'f5'));
    state = chessEngine.applyMove(state, move('b8', 'a8', 'black'));
    expect(MAX_WALLS).toBe(2);
    expect(wallTargets(state, 'h2')).toEqual([]);
    expect(getAbilityOptions(state, 'h2').find(o => o.modifierId === HUT)?.status).toBe('0 of 2 walls left');
  });

  it('never takes away the last legal move of either King', () => {
    // Black King on h8 can only go to g8: h7 and g7 are covered by the white rook on a7.
    const state = withHut([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'a7'),
      makePiece('rook', 'white', 'f7'),
      makePiece('king', 'black', 'h8'),
    ]);
    const targets = wallTargets(state, 'f7');
    expect(targets).not.toContain('g8');
    expect(targets).toContain('e8');
  });

  it('keeps its own King safe: no wall while in check unless it blocks', () => {
    const state = withHut([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a4'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(wallTargets(state, 'a4')).toEqual([]);
  });

  it('is solid to Gerald\'s statue (interaction with Monument To Gerald)', () => {
    const state = withHut(
      [makePiece('king', 'white', 'a1'), makePiece('rook', 'white', 'g5'), makePiece('bishop', 'white', 'd3'), makePiece('king', 'black', 'h8')],
      [{ id: MODIFIER_IDS.monumentToGerald, sourceColor: null }],
    );
    expect(state.tiles.get('e4')?.statue).toBe(true);
    // Without a wall the bishop on d3 may push the statue from e4 to f5.
    expect(chessEngine.getLegalMoves(state, 'd3')).toContain('e4');
    const walled = chessEngine.applyMove(state, build('g5', 'f5'));
    walled.turn = 'white';
    expect(chessEngine.getLegalMoves(walled, 'd3')).not.toContain('e4');
  });

  it('only rooks of the owner can build', () => {
    const state = withHut([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('rook', 'black', 'h5'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.turn = 'black';
    expect(wallTargets(state, 'h5')).toEqual([]);
    expect(chessEngine.validateMove(state, build('h5', 'h4', 'black')).valid).toBe(false);
  });

  it('is offered in the draft', () => {
    const options = getValidOptions([], [], new Set([HUT]));
    expect(options.map(o => o.id)).toContain(HUT);
  });
});
