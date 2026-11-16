import type { Color, GameState, ModifierID, Move } from '../engine/types';
import type { ModifierDefinition, PreMoveResult } from './types';
import { buildMove, getValidPromotionTypes, isPromotionMove } from '../engine/gameLoop';
import { getLegalMovesForPiece, isInCheck } from '../engine/moveGenerator';
import { validateMove } from '../engine/moveValidator';
import { abilityCooldownLeft, getActiveAbility } from '../engine/abilities';
import { affectsColor } from './owner';
import { getVisibleSquares } from '../engine/visibility';

/**
 * A curse that limits which move its owner may make this turn: "you must
 * capture with a pawn" (MOD-B019), "move your Queen" (MOD-B010), and so on.
 *
 * Every move rule follows the same three rulings:
 * - In check, it does not apply. Any legal move is allowed.
 * - It only applies when at least one legal move keeps it, so it never
 *   takes away the last move.
 * - When two rules apply to one side, the earlier one in RULE_ORDER wins.
 *   A later rule only applies if some legal move keeps both.
 */
export interface MoveRule {
  /** True if the move keeps the rule. Called often, so keep it cheap. */
  allows: (state: GameState, move: Move) => boolean;
  /** Shown when a move breaks the rule. */
  reason: string;
  /**
   * A demand ("you must move X") also forbids spending the turn without a
   * move (shooing Gerald). A plain limit ("X cannot move") does not.
   */
  demand: boolean;
}

/** The rule a card puts on `color` this turn, before check and "only if you can". */
export type MoveRuleSource = (state: GameState, color: Color) => MoveRule | null;

/**
 * Limits first, then demands, so a demand only asks for a move the limits
 * allow (Lunch Break keeps the Queen at lunch even when she is demanded).
 */
const RULE_ORDER: ModifierID[] = [
  'MOD-B016', // Lunch Break
  'MOD-B011', // Case Of The Mondays
  'MOD-B019', // Peer Pressure
  'MOD-B010', // Main Character Syndrome
  'MOD-B020', // Roll For Initiative
];

/** True for the cards whose rule limits which move you may make (see RULE_ORDER). */
export function isMoveRuleCard(id: ModifierID): boolean {
  return RULE_ORDER.includes(id);
}

const sources = new Map<ModifierID, MoveRuleSource>();

export function registerMoveRule(id: ModifierID, source: MoveRuleSource): void {
  sources.set(id, source);
}

/** True while the rules are checking which moves exist. Rules stay out of it, so this cannot loop. */
let measuring = false;

/**
 * Every action `color` could try now, before validation: normal moves and
 * ability targets. Under fog, only moves onto squares you can see count, so
 * a rule never gives away a hidden piece.
 */
function candidateActions(state: GameState, color: Color): Move[] {
  const visible = getVisibleSquares(state, color);
  const actions: Move[] = [];
  for (const piece of state.pieces.values()) {
    if (piece.color !== color) continue;
    for (const to of getLegalMovesForPiece(state, piece)) {
      if (visible && !visible.has(to)) continue;
      actions.push({ ...buildMove(state, piece.square, to), playerColor: color });
    }
    for (const inst of state.activeModifiers) {
      const ability = getActiveAbility(state, inst.id);
      if (!ability || !ability.pieceTypes.includes(piece.type)) continue;
      if (!affectsColor(state, inst.id, color) || abilityCooldownLeft(piece, inst.id) > 0) continue;
      for (const to of ability.getTargets(state, piece)) {
        if (visible && !visible.has(to)) continue;
        actions.push({ from: piece.square, to, playerColor: color, ability: inst.id });
      }
    }
  }
  return actions;
}

/** True if the action passes every other card and the self-check rule. */
function isPlayable(state: GameState, move: Move): boolean {
  if (!move.ability && isPromotionMove(state, move.from, move.to)) {
    return getValidPromotionTypes(state, move.from, move.to).length > 0;
  }
  return validateMove(state, move).valid;
}

interface Binding {
  id: ModifierID;
  rule: MoveRule;
}

/** The rules that bind `color` this turn, in order. Empty in check or when no card applies. */
export function getBindingMoveRules(state: GameState, color: Color): Binding[] {
  if (measuring || state.status !== 'active' || state.turn !== color) return [];
  const active = new Set(state.activeModifiers.map(mod => mod.id));
  const candidates: Binding[] = [];
  for (const id of RULE_ORDER) {
    if (!active.has(id)) continue;
    const rule = sources.get(id)?.(state, color);
    if (rule) candidates.push({ id, rule });
  }
  if (candidates.length === 0 || isInCheck(state, color)) return [];

  // Cheap rule tests first; full validation only until one playable action is found.
  const actions = candidateActions(state, color);
  const playable = new Map<Move, boolean>();
  const binding: Binding[] = [];
  measuring = true;
  try {
    for (const candidate of candidates) {
      const rules = [...binding, candidate].map(b => b.rule);
      const found = actions.some(move => {
        if (!rules.every(rule => rule.allows(state, move))) return false;
        let ok = playable.get(move);
        if (ok === undefined) {
          ok = isPlayable(state, move);
          playable.set(move, ok);
        }
        return ok;
      });
      if (found) binding.push(candidate);
    }
  } finally {
    measuring = false;
  }
  return binding;
}

/** The binding rule of card `id` on `color`, or null. */
export function getBindingMoveRule(state: GameState, color: Color, id: ModifierID): MoveRule | null {
  return getBindingMoveRules(state, color).find(b => b.id === id)?.rule ?? null;
}

/**
 * The onPreMoveValidate and blocksPass hooks for a move-rule card. The
 * card's own `allows` runs first, so a move that keeps the rule costs
 * nothing extra.
 */
export function moveRuleHooks(id: ModifierID): Pick<ModifierDefinition, 'onPreMoveValidate' | 'blocksPass'> {
  return {
    onPreMoveValidate(state: GameState, move: Move): PreMoveResult {
      if (measuring) return { blocked: false };
      const own = sources.get(id)?.(state, move.playerColor);
      if (!own || own.allows(state, move)) return { blocked: false };
      const rule = getBindingMoveRule(state, move.playerColor, id);
      if (!rule || rule.allows(state, move)) return { blocked: false };
      return { blocked: true, reason: rule.reason };
    },
    blocksPass(state: GameState): string | null {
      if (measuring) return null;
      const own = sources.get(id)?.(state, state.turn);
      if (!own?.demand) return null;
      const rule = getBindingMoveRule(state, state.turn, id);
      return rule?.demand ? rule.reason : null;
    },
  };
}
