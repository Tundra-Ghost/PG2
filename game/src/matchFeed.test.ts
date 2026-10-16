import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@pigeon-chess/game-core';
import { pickBannerEvent } from './matchFeed';

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
