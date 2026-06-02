import type { Color, Piece } from '../../engine/types';
import { MODIFIER_IDS } from '../../modifiers/ids';

const GERALD_ID = MODIFIER_IDS.gerald;

export function shouldForfeitTurnForGerald(
  piece: Piece | undefined,
  turn: Color,
): boolean {
  if (!piece) return false;
  if (piece.color !== turn) return false;
  return (piece.cooldowns[GERALD_ID] ?? 0) > 0;
}
