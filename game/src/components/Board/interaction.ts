import type { Color, Piece } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';

const GERALD_ID = MODIFIER_IDS.gerald;

export function shouldForfeitTurnForGerald(
  piece: Piece | undefined,
  turn: Color,
): boolean {
  if (!piece) return false;
  if (piece.color !== turn) return false;
  return (piece.cooldowns[GERALD_ID] ?? 0) > 0;
}

export interface MarkerLegendEntry {
  mark: string;
  label: string;
}

/** Piece and tile markers, in the order they appear in the legend. */
const MARKER_LEGEND: Array<{ modifierId: string } & MarkerLegendEntry> = [
  { modifierId: MODIFIER_IDS.floorIsLava, mark: '▲', label: 'Lava' },
  { modifierId: MODIFIER_IDS.winterIsComing, mark: '❄', label: 'Frozen' },
  { modifierId: MODIFIER_IDS.thisIsMySwamp, mark: '≈', label: 'Swamp' },
  { modifierId: MODIFIER_IDS.gerald, mark: 'G', label: 'Gerald' },
  { modifierId: MODIFIER_IDS.conscientiousObjector, mark: 'O', label: 'Pacifist' },
  { modifierId: MODIFIER_IDS.berserker, mark: 'B', label: 'Berserker' },
  { modifierId: MODIFIER_IDS.traitor, mark: '!', label: 'Traitor' },
  { modifierId: MODIFIER_IDS.rejectQueen, mark: '»', label: 'Chain ready' },
  { modifierId: MODIFIER_IDS.chancellor, mark: 'C', label: 'Chancellor' },
  { modifierId: MODIFIER_IDS.ventTiles, mark: '●', label: 'Vent shaft' },
];

/** Legend rows for the markers that can appear in this match. */
export function getMarkerLegend(activeModifierIds: readonly string[]): MarkerLegendEntry[] {
  return MARKER_LEGEND
    .filter(entry => activeModifierIds.includes(entry.modifierId))
    .map(({ mark, label }) => ({ mark, label }));
}
