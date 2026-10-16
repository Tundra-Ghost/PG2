import type { Square } from '../../engine/types';

/** MOD-A006: the four central squares are the Swamp. */
export const SWAMP_SQUARES: readonly Square[] = ['d4', 'd5', 'e4', 'e5'];

export function isSwampSquare(square: string): boolean {
  return (SWAMP_SQUARES as readonly string[]).includes(square);
}
