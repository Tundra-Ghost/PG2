import type { Piece } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';

export interface PieceMarkers {
  /** Badge marks, top to bottom. */
  marks: string[];
  gerald: boolean;
  berserker: boolean;
  traitor: boolean;
  /** Spoken description for screen readers. */
  label: string;
}

/** What a piece wears on the board. Shared by the DOM and Phaser boards. */
export function getPieceMarkers(piece: Piece): PieceMarkers {
  const { cooldowns, isPacifist, isBerserker, isTraitor, hasPromotionChain } = piece;
  const amazon = piece.isAmazon === true && piece.type === 'queen';
  const gerald = (cooldowns[MODIFIER_IDS.gerald] ?? 0) > 0;
  const frozen = (cooldowns[MODIFIER_IDS.winterIsComing] ?? 0) > 0;
  const stuck = (cooldowns[MODIFIER_IDS.thisIsMySwamp] ?? 0) > 0;
  const eggRounds = piece.type === 'egg' ? cooldowns[MODIFIER_IDS.hatchery] : undefined;

  const marks: string[] = [];
  if (frozen) marks.push('❄');
  if (stuck) marks.push('≈');
  if (isPacifist) marks.push('O');
  if (isBerserker) marks.push('B');
  if (isTraitor) marks.push('!');
  if (hasPromotionChain) marks.push('»');
  // ♞, not A: the Archbishop already uses A in the move list.
  if (amazon) marks.push('♞');
  if (piece.isTouched) marks.push('T');
  if (eggRounds !== undefined) marks.push(String(eggRounds));

  const label = [
    gerald ? 'gerald blocked' : null,
    frozen ? 'frozen' : null,
    stuck ? 'stuck in the swamp' : null,
    isPacifist ? 'pacifist' : null,
    isBerserker ? 'berserker' : null,
    isTraitor ? 'traitor' : null,
    hasPromotionChain ? 'chain ready' : null,
    amazon ? 'amazon, also moves like a knight' : null,
    piece.isTouched ? 'touched, must move' : null,
    eggRounds !== undefined ? `egg, hatches in ${eggRounds} of its side's moves` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return { marks, gerald, berserker: !!isBerserker, traitor: !!isTraitor, label };
}
