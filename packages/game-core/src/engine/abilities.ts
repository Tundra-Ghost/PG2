import type { Color, GameState, ModifierID, Move, Piece, PieceType, Square } from './types';
import type { AbilityResult, AbilitySpec } from '../modifiers/types';
import { modifierRegistry } from '../modifiers/registry';
import { affectsColor } from '../modifiers/owner';
import { applyMoveInternal, cloneState } from './gameLoop';
import { isInCheck } from './moveGenerator';
import { validateMove } from './moveValidator';

/** The ability a move uses, if its modifier is active and has one. */
export function getActiveAbility(state: GameState, id: ModifierID): AbilitySpec | null {
  if (!state.activeModifiers.some(mod => mod.id === id)) return null;
  return modifierRegistry.get(id)?.ability ?? null;
}

export function abilityCooldownLeft(piece: Piece, id: ModifierID): number {
  return piece.abilityCooldowns?.[id] ?? 0;
}

/**
 * Stage checks for an ability move, before modifier hooks and self-check:
 * active card, owned by the mover, right piece type, off cooldown, valid target.
 */
export function checkAbilityMove(state: GameState, move: Move): string | null {
  const id = move.ability!;
  const ability = getActiveAbility(state, id);
  if (!ability) return 'That ability is not in this match.';
  const piece = state.pieces.get(move.from);
  if (!piece) return 'no piece at source';
  if (!affectsColor(state, id, piece.color)) return 'That ability belongs to the other side.';
  if (!ability.pieceTypes.includes(piece.type)) return 'That piece cannot use this ability.';
  const left = abilityCooldownLeft(piece, id);
  if (left > 0) return `That ability is ready in ${left} turn${left === 1 ? '' : 's'}.`;
  if (!ability.getTargets(state, piece).includes(move.to)) return 'Not a valid ability target.';
  return null;
}

/** Applies the ability's physical effect without hooks, turn switch or history. */
export function performAbility(state: GameState, move: Move): AbilityResult {
  const ability = getActiveAbility(state, move.ability!)!;
  if (ability.apply) return ability.apply(state, move);
  const captured = state.pieces.get(move.to);
  const plain: Move = { from: move.from, to: move.to, playerColor: move.playerColor };
  return { state: applyMoveInternal(state, plain), captured };
}

/** One own turn passed: every ability cooldown of `color` ticks down. */
export function tickAbilityCooldowns(state: GameState, color: Color): GameState {
  const needsTick = Array.from(state.pieces.values()).some(
    p => p.color === color && p.abilityCooldowns && Object.keys(p.abilityCooldowns).length > 0,
  );
  if (!needsTick) return state;
  const next = cloneState(state);
  for (const [sq, piece] of next.pieces) {
    if (piece.color !== color || !piece.abilityCooldowns) continue;
    const abilityCooldowns: Record<ModifierID, number> = {};
    for (const [id, left] of Object.entries(piece.abilityCooldowns)) {
      if (left > 1) abilityCooldowns[id] = left - 1;
    }
    next.pieces.set(sq, { ...piece, abilityCooldowns });
  }
  return next;
}

/** Starts the cooldown on the piece that used the ability (it may have moved). */
export function startAbilityCooldown(state: GameState, pieceId: string, id: ModifierID): GameState {
  const ability = modifierRegistry.get(id)?.ability;
  if (!ability) return state;
  const piece = Array.from(state.pieces.values()).find(p => p.id === pieceId);
  if (!piece) return state;
  const next = cloneState(state);
  next.pieces.set(piece.square, {
    ...piece,
    abilityCooldowns: { ...piece.abilityCooldowns, [id]: ability.cooldown },
  });
  return next;
}

const LETTER: Partial<Record<PieceType, string>> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P', chancellor: 'C', royal_guard: 'G',
};

export function buildAbilityNotation(
  stateBefore: GameState,
  move: Move,
  isCapture: boolean,
  stateAfter: GameState,
): string {
  const ability = modifierRegistry.get(move.ability!)?.ability;
  const piece = stateBefore.pieces.get(move.from);
  const base = ability?.notation?.(stateBefore, move)
    ?? `${LETTER[piece?.type ?? 'pawn'] ?? ''}${move.from}${isCapture ? 'x' : '-'}${move.to}`;
  const opponent: Color = move.playerColor === 'white' ? 'black' : 'white';
  if (stateAfter.status === 'checkmate') return `${base}#`;
  if (isInCheck(stateAfter, opponent)) return `${base}+`;
  return base;
}

export interface AbilityOption {
  modifierId: ModifierID;
  label: string;
  hint: string;
  /** 0 when ready. */
  cooldownLeft: number;
  /** Targets that pass full validation. Empty while cooling down. */
  targets: Square[];
}

/** Abilities the piece on `square` could use now or later, for the ability button. */
export function getAbilityOptions(state: GameState, square: Square): AbilityOption[] {
  const piece = state.pieces.get(square);
  if (!piece || state.status !== 'active') return [];
  const options: AbilityOption[] = [];
  const seen = new Set<ModifierID>();
  for (const inst of state.activeModifiers) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    const ability = modifierRegistry.get(inst.id)?.ability;
    if (!ability || !ability.pieceTypes.includes(piece.type)) continue;
    if (!affectsColor(state, inst.id, piece.color)) continue;
    const cooldownLeft = abilityCooldownLeft(piece, inst.id);
    const targets = cooldownLeft > 0 || piece.color !== state.turn
      ? []
      : ability.getTargets(state, piece).filter(to =>
          validateMove(state, { from: square, to, playerColor: piece.color, ability: inst.id }).valid,
        );
    options.push({ modifierId: inst.id, label: ability.label, hint: ability.hint, cooldownLeft, targets });
  }
  return options;
}
