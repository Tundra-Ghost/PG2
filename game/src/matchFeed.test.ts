import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@pigeon-chess/game-core';
import { formatEventMessage, getModifierEventBannerMessage, pickBannerEvent } from './matchFeed';

function event(id: string, modifierId: string): GameEvent {
  return { id, ply: 1, type: 'modifier', modifierId, title: id, message: id };
}

describe('banner event choice', () => {
  const lava = event('lava', 'MOD-A002');
  const review = event('review', 'MOD-B008');

  it('prefers a board event over Reginald commentary from the same move', () => {
    expect(pickBannerEvent([lava, review], null)).toBe(lava);
  });

  it('still shows Reginald when he is the only new event', () => {
    expect(pickBannerEvent([lava, review], 'lava')).toBe(review);
  });

  it('returns null when nothing new arrived', () => {
    expect(pickBannerEvent([lava], 'lava')).toBeNull();
  });
});

describe('banner message', () => {
  it('names the players instead of white and black', () => {
    const event = { id: 'e1', ply: 4, type: 'modifier', title: 'Smoke', message: 'The black side sees through it.' } as GameEvent;
    expect(getModifierEventBannerMessage(event, 'Player', 'Chick')).toBe("Smoke: Chick's side sees through it.");
  });
});

describe('event message labels (#178)', () => {
  it('drops "the" before a side name', () => {
    expect(formatEventMessage('A seagull carries the white pawn from g5 back to g4.', 'Ann', 'Bo'))
      .toBe("A seagull carries Ann's pawn from g5 back to g4.");
    expect(formatEventMessage('The black pawn on e2 guards the bishop on f1.', 'Ann', 'Bo'))
      .toBe("Bo's pawn on e2 guards the bishop on f1.");
  });

  it('keeps plain side names', () => {
    expect(formatEventMessage('Check on white. Then black.', 'Ann', 'Bo')).toBe('Check on Ann. Then Bo.');
  });
});
