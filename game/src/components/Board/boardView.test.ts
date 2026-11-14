import { describe, expect, it } from 'vitest';
import { chessEngine, MODIFIER_IDS } from '@pigeon-chess/game-core';
import { buildSquareViews } from './boardView';
import { getMarkerLegend } from './interaction';
import { getPieceMarkers } from '../Piece/pieceMarkers';

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

  it('draws a Sus piece as its disguise for the opponent only', () => {
    const state = chessEngine.getInitialState();
    const knight = state.pieces.get('g1')!;
    state.modifierState[MODIFIER_IDS.sus] = { white: { pieceId: knight.id, shownAs: 'queen' } };
    const at = (viewer: 'white' | 'black') => buildSquareViews({ ...base, state, orientation: 'white', viewer }).find(v => v.square === 'g1')!;
    expect(at('black').piece?.type).toBe('queen');
    expect(at('black').susAs).toBeUndefined();
    expect(at('white').piece?.type).toBe('knight');
    expect(at('white').susAs).toBe('queen');
  });

  it('gives a Sus queen the Amazon badge when its side has an Amazon', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.slayQueen, sourceColor: 'white' },
    ]);
    const knight = state.pieces.get('g1')!;
    state.modifierState[MODIFIER_IDS.sus] = { white: { pieceId: knight.id, shownAs: 'queen' } };
    const views = buildSquareViews({ ...base, state, orientation: 'white', viewer: 'black' });
    const fake = views.find(v => v.square === 'g1')!.piece!;
    const real = views.find(v => v.square === 'd1')!.piece!;
    expect(getPieceMarkers(fake).marks).toEqual(getPieceMarkers(real).marks);
    expect(getPieceMarkers(real).marks).toContain('A');
  });

  it('marks only an Amazon queen with A', () => {
    const queen = { id: 'q', type: 'queen' as const, color: 'white' as const, square: 'd1' as const, cooldowns: {}, isAmazon: true };
    expect(getPieceMarkers(queen).marks).toContain('A');
    expect(getPieceMarkers(queen).label).toContain('amazon');
    expect(getPieceMarkers({ ...queen, type: 'royal_guard' }).marks).not.toContain('A');
    expect(getMarkerLegend([MODIFIER_IDS.slayQueen])).toEqual([{ mark: 'A', label: 'Amazon (Queen + knight)' }]);
  });

  it('fades a Ghost for its owner only', () => {
    const state = chessEngine.getInitialState();
    state.pieces.set('c3', { id: 'g', type: 'bishop', color: 'white', square: 'c3', isGhost: true, cooldowns: {} });
    const at = (viewer: 'white' | 'black') => buildSquareViews({ ...base, state, orientation: 'white', viewer }).find(v => v.square === 'c3')!;
    expect(at('white').ghost).toBe(true);
    expect(at('black').ghost).toBeUndefined();
    expect(at('black').piece?.type).toBe('bishop');
  });
});
