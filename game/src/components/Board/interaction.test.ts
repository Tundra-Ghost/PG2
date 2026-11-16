import { describe, expect, it } from 'vitest';
import type { Piece } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import { getMarkerLegend, shouldForfeitTurnForGerald } from './interaction';

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

describe('board marker legend', () => {
  it('is empty in a standard game', () => {
    expect(getMarkerLegend([])).toEqual([]);
  });

  it('lists only the markers of active modifiers, in a fixed order', () => {
    expect(getMarkerLegend(['MOD-B002', 'MOD-A004'])).toEqual([
      { mark: '❄', label: 'Frozen' },
      { mark: 'G', label: 'Gerald' },
    ]);
  });

  it("says the Egg counts its own side's moves, and drops the row once no Egg is left", () => {
    const hatchery = [MODIFIER_IDS.hatchery];
    expect(getMarkerLegend(hatchery, { eggOnBoard: true })).toEqual([
      { mark: '10', label: "Egg: its side's moves until it hatches" },
    ]);
    expect(getMarkerLegend(hatchery, { eggOnBoard: false })).toEqual([]);
  });

  describe('No, I Don\'t Think I Will row', () => {
    const B003 = 'MOD-B003';
    const row = (ctx: Parameters<typeof getMarkerLegend>[1]) => getMarkerLegend([B003], ctx)[0];

    it('counts down the flipped moves left', () => {
      expect(row({ flippedMovesLeft: 5 })?.label).toBe('5 flipped moves left: click across the board');
      expect(row({ flippedMovesLeft: 1 })?.label).toBe('1 flipped move left: click across the board');
    });

    it('says tap on a touch screen', () => {
      expect(row({ flippedMovesLeft: 3, touchScreen: true })?.label).toBe('3 flipped moves left: tap across the board');
    });

    it('goes away when no flipped moves are left', () => {
      expect(getMarkerLegend([B003], { flippedMovesLeft: 0 })).toEqual([]);
    });

    it('keeps the general text when the count is unknown', () => {
      expect(row({})?.label).toBe('Your first 5 moves: click across the board');
    });
  });
});
