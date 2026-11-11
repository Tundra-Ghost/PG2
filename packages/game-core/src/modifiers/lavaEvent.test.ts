import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece } from './testHelpers';
import { getLavaPreview } from './definitions/floor-is-lava';

describe('lava burn event', () => {
  it('names the square the piece burned on, for the board animation', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd1'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.activeModifiers = [
      { id: MODIFIER_IDS.floorIsLava, name: 'The Floor Is Lava', activeFor: 'both', sourceColor: null },
    ];
    state.tiles.set('d5', { square: 'd5', effects: [{ type: 'lava', turnsRemaining: -1 }] });

    const next = chessEngine.applyMove(state, { from: 'd1', to: 'd5', playerColor: 'white' });

    expect(next.pieces.has('d5')).toBe(false);
    const burn = next.eventHistory.find(event => event.modifierId === MODIFIER_IDS.floorIsLava);
    expect(burn?.squares).toEqual(['d5']);
  });
});

describe('lava preview', () => {
  const lavaSquares = (state: ReturnType<typeof makeEmptyState>) =>
    Array.from(state.tiles.values()).filter(t => t.effects.some(e => e.type === 'lava')).map(t => t.square).sort();

  function start() {
    return chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'h1'),
        makePiece('rook', 'white', 'a1'),
        makePiece('king', 'black', 'h8'),
      ]),
      [{ id: MODIFIER_IDS.floorIsLava, sourceColor: null }],
    );
  }

  it('shows 4 next squares, away from the current lava', () => {
    const state = start();
    const preview = getLavaPreview(state);
    expect(preview).toHaveLength(4);
    for (const sq of preview) expect(lavaSquares(state)).not.toContain(sq);
  });

  it('moves lava to the previewed squares and picks a new preview', () => {
    let state = start();
    const preview = [...getLavaPreview(state)].sort();
    state.turnNumber = 3;
    state = chessEngine.beginTurn(state);
    expect(lavaSquares(state)).toEqual(preview);
    expect(getLavaPreview(state)).toHaveLength(4);
    expect(getLavaPreview(state).some(sq => preview.includes(sq))).toBe(false);
  });

  it('swaps a previewed square that a piece now stands on', () => {
    let state = start();
    const [blocked, ...rest] = getLavaPreview(state);
    const rook = state.pieces.get('a1')!;
    state.pieces.delete('a1');
    state.pieces.set(blocked, { ...rook, square: blocked });
    state.turnNumber = 3;
    state = chessEngine.beginTurn(state);
    const lava = lavaSquares(state);
    expect(lava).toHaveLength(4);
    expect(lava).not.toContain(blocked);
    for (const sq of rest) expect(lava).toContain(sq);
    expect(state.pieces.get(blocked)?.type).toBe('rook');
  });
});
