import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';
import { makeEmptyState, makePiece } from '../modifiers/testHelpers';
import { chessEngine } from './ChessEngine';
import { getChickBotMove, getPigeonBotMove } from './bot';

const first = () => 0;

describe('Pigeon bot', () => {
  it('finds a mate in one', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'g1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'g8'),
      makePiece('pawn', 'black', 'f7'),
      makePiece('pawn', 'black', 'g7'),
      makePiece('pawn', 'black', 'h7'),
    ]);
    expect(getPigeonBotMove(state, 'white', { depth: 3, timeBudgetMs: Infinity, random: first })).toMatchObject({ from: 'a1', to: 'a8' });
  });

  it('does not take a defended pawn with its queen, unlike Chick', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('pawn', 'black', 'e6'),
    ]);
    expect(getChickBotMove(state, 'white')).toMatchObject({ from: 'd1', to: 'd5' });
    expect(getPigeonBotMove(state, 'white', { depth: 3, timeBudgetMs: Infinity, random: first })).not.toMatchObject({ from: 'd1', to: 'd5' });
  });

  it('will not step its queen onto lava', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'd7'),
    ]);
    state.activeModifiers = [
      { id: MODIFIER_IDS.floorIsLava, name: 'The Floor Is Lava', activeFor: 'both', sourceColor: null },
    ];
    // Lava on the only capture, so a material-only look says "free pawn".
    state.tiles.set('d7', { square: 'd7', effects: [{ type: 'lava', turnsRemaining: -1 }] });
    const move = getPigeonBotMove(state, 'white', { depth: 2, timeBudgetMs: Infinity, random: first });
    expect(move).not.toBeNull();
    expect(move!.to).not.toBe('d7');
  });

  it('plays a legal opening move fast enough for the table', () => {
    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    const started = Date.now();
    const move = getPigeonBotMove(state, 'white');
    expect(move).not.toBeNull();
    expect(chessEngine.validateMove(state, move!).valid).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('falls back to a shallower search when out of time', () => {
    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    const started = Date.now();
    const move = getPigeonBotMove(state, 'white', { depth: 6, timeBudgetMs: 50 });
    expect(move).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
