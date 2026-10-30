import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece } from './testHelpers';

const berserker = { id: MODIFIER_IDS.berserker, name: 'Berserker', activeFor: 'both' as const, sourceColor: 'white' as const };

describe('berserker events', () => {
  it('name both squares of a chain on the ply the board shows', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      { ...makePiece('rook', 'white', 'd1'), isBerserker: true },
      makePiece('king', 'black', 'h8'),
      makePiece('knight', 'black', 'd4'),
      makePiece('bishop', 'black', 'd6'),
    ]);
    state.activeModifiers = [berserker];

    const next = chessEngine.applyMove(state, { from: 'd1', to: 'd4', playerColor: 'white' });

    const chain = next.eventHistory.find(event => event.modifierId === MODIFIER_IDS.berserker);
    expect(chain?.squares).toEqual(['d4', 'd6']);
    expect(chain?.ply).toBe(next.moveHistory.length);
  });

  it('name the square that inherits the title', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      { ...makePiece('rook', 'white', 'a1'), isBerserker: true },
      makePiece('bishop', 'white', 'c1'),
      makePiece('king', 'black', 'e8'),
      makePiece('queen', 'black', 'a5'),
    ]);
    state.turn = 'black';
    state.activeModifiers = [berserker];

    const next = chessEngine.applyMove(state, { from: 'a5', to: 'a1', playerColor: 'black' });

    const pass = next.eventHistory.find(event => event.modifierId === MODIFIER_IDS.berserker);
    expect(pass?.squares).toEqual(['c1']);
    expect(pass?.ply).toBe(next.moveHistory.length);
  });
});
