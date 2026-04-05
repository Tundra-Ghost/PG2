import type { Square } from '../../engine/types';

const FROZEN_RANKS = new Set(['1', '2', '3', '6', '7', '8']);

export function isFrozenZoneSquare(square: Square): boolean {
  return FROZEN_RANKS.has(square[1]);
}
