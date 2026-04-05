import { describe, expect, it } from 'vitest';
import type { Piece } from '../../engine/types';
import { shouldForfeitTurnForGerald } from './interaction';

function makePiece(
  color: Piece['color'],
  cooldown = 0,
): Piece {
  return {
    id: `${color}-rook-a1`,
    type: 'rook',
    color,
    square: 'a1',
    cooldowns: cooldown > 0 ? { 'MOD-B002': cooldown } : {},
  };
}

describe('board Gerald interaction', () => {
  it('forfeits the turn when the current side clicks a Gerald-blocked piece', () => {
    expect(shouldForfeitTurnForGerald(makePiece('white', 2), 'white')).toBe(true);
  });

  it('does not forfeit for unblocked pieces or the wrong side', () => {
    expect(shouldForfeitTurnForGerald(makePiece('white', 0), 'white')).toBe(false);
    expect(shouldForfeitTurnForGerald(makePiece('black', 2), 'white')).toBe(false);
    expect(shouldForfeitTurnForGerald(undefined, 'white')).toBe(false);
  });
});
