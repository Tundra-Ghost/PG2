import { describe, expect, it } from 'vitest';
import { chessEngine } from '@pigeon-chess/game-core';
import { buildSquareViews } from './boardView';

const base = {
  selected: null,
  legalMoves: [],
  showLegalMoves: true,
  checkSquare: null,
  bursts: new Map(),
};

describe('buildSquareViews', () => {
  it('lists squares top-left first for each orientation', () => {
    const state = chessEngine.getInitialState();
    const white = buildSquareViews({ ...base, state, orientation: 'white' });
    const black = buildSquareViews({ ...base, state, orientation: 'black' });
    expect(white).toHaveLength(64);
    expect(white[0].square).toBe('a8');
    expect(white[63].square).toBe('h1');
    expect(black[0].square).toBe('h1');
    expect(white[0].piece?.type).toBe('rook');
    // a1 is a dark square.
    expect(white.find(v => v.square === 'a1')?.isLight).toBe(false);
  });

  it('marks selection, legal targets and the last move', () => {
    const state = chessEngine.getInitialState();
    const views = buildSquareViews({
      ...base,
      state,
      orientation: 'white',
      selected: 'e2',
      legalMoves: ['e3', 'e4'],
      lastFrom: 'g1',
      lastTo: 'f3',
    });
    const at = (sq: string) => views.find(v => v.square === sq)!;
    expect(at('e2').isSelected).toBe(true);
    expect(at('e4').isLegalTarget).toBe(true);
    expect(at('f3').isLastMove).toBe(true);
    expect(buildSquareViews({ ...base, state, orientation: 'white', legalMoves: ['e4'], showLegalMoves: false })
      .find(v => v.square === 'e4')!.isLegalTarget).toBe(false);
  });
});
