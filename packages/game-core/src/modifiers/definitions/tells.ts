import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { abilityCooldownLeft } from '../../engine/abilities';
import { getVisibleSquares } from '../../engine/visibility';
import { modifierRegistry } from '../registry';
import { MODIFIER_IDS } from '../ids';
import { affectsColor } from '../owner';
import { getShownType } from './sus';

const ID = MODIFIER_IDS.tells;

/**
 * For `viewer` with Tells: each enemy piece in sight that has an ability,
 * mapped to 0 when one is ready, else the fewest turns until one is.
 */
export function getTells(state: GameState, viewer: Color): Map<Square, number> {
  const tells = new Map<Square, number>();
  if (!affectsColor(state, ID, viewer)) return tells;
  const enemy: Color = viewer === 'white' ? 'black' : 'white';
  const visible = getVisibleSquares(state, viewer);
  const abilities = [...new Set(state.activeModifiers.map(mod => mod.id))]
    .filter(id => affectsColor(state, id, enemy))
    .map(id => ({ id, spec: modifierRegistry.get(id)?.ability }))
    .filter(a => a.spec);
  for (const piece of state.pieces.values()) {
    if (piece.color !== enemy || (visible && !visible.has(piece.square))) continue;
    // A Sus piece is judged as the type the viewer sees, so the tell never gives the disguise away.
    const seen = { ...piece, type: getShownType(state, piece, viewer) };
    let best: number | null = null;
    for (const { id, spec } of abilities) {
      if (!spec!.pieceTypes.includes(seen.type)) continue;
      const left = abilityCooldownLeft(seen, id);
      // Ready means off cooldown with something to aim at (a Moneyball King with no token is not).
      if (left === 0 && spec!.getTargets(state, seen).length === 0) continue;
      best = best === null ? left : Math.min(best, left);
    }
    if (best !== null) tells.set(piece.square, best);
  }
  return tells;
}

/**
 * MOD-D018: the owner sees which enemy pieces have an ability ready (a
 * glow) and how many turns the others still wait. The draft only offers it
 * once the opponent has a card with an ability (draft/rules.ts).
 */
export const tellsDef: ModifierDefinition = {
  id: ID,
  name: 'Tells',
  category: 'D',
  pointCost: 1,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',
};
