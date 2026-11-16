import type { ModifierDefinition } from '../types';
import type { Color, GameState, PieceType } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { affectsColor, ownMoveNumber } from '../owner';
import { getBindingMoveRule, moveRuleHooks, registerMoveRule } from '../move-rules';

const ID = MODIFIER_IDS.rollForInitiative;
/** The die is rolled on every this many of your moves. */
export const ROLL_EVERY = 3;

/** Die faces, in a fixed order so a replay rolls the same face. */
const FACES: PieceType[] = [
  'king', 'queen', 'rook', 'bishop', 'knight', 'pawn',
  'chancellor', 'archbishop', 'elephant', 'camel', 'nightrider', 'royal_guard', 'pigeon',
  'cannon',
];

const NAMES: Partial<Record<PieceType, string>> = { royal_guard: 'Royal Guard', king: 'King', queen: 'Queen' };

function pieceName(type: PieceType): string {
  return NAMES[type] ?? type;
}

interface Roll {
  color: Color;
  turnNumber: number;
  type: PieceType;
}

function readRoll(state: GameState): Roll | undefined {
  return (state.modifierState[ID] as { roll?: Roll } | undefined)?.roll;
}

/** The piece type the die picked for `color` this turn, if it rolled. */
export function getInitiativeRoll(state: GameState, color: Color): PieceType | null {
  const roll = readRoll(state);
  if (!roll || roll.color !== color || roll.turnNumber !== state.turnNumber) return null;
  if (!affectsColor(state, ID, color)) return null;
  return roll.type;
}

/** True when the die binds `color` this turn (not in check, and a piece of that type can move). */
export function mustMoveRolledType(state: GameState, color: Color): boolean {
  return getBindingMoveRule(state, color, ID) !== null;
}

/** "a knight", "an archbishop". */
function aPiece(type: PieceType): string {
  const name = pieceName(type);
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function reasonFor(type: PieceType): string {
  return `Roll For Initiative: the die says ${pieceName(type)}. Move ${aPiece(type)}.`;
}

registerMoveRule(ID, (state, color) => {
  const type = getInitiativeRoll(state, color);
  if (!type) return null;
  return {
    allows: (s, move) => {
      // Sacrificing the piece (The Snap) is not moving it.
      if (move.ability === MODIFIER_IDS.theSnap) return false;
      const piece = s.pieces.get(move.from);
      return piece?.type === type && piece.color === move.playerColor;
    },
    reason: reasonFor(type),
    demand: true,
  };
});

/** The types `color` still has on the board, in die order. Eggs cannot move, so they are not a face. */
function facesFor(state: GameState, color: Color): PieceType[] {
  const have = new Set<PieceType>();
  for (const piece of state.pieces.values()) {
    if (piece.color === color && !piece.isGhost) have.add(piece.type);
  }
  return FACES.filter(type => have.has(type));
}

/** MOD-B020 Roll For Initiative: every 3rd move, a die picks which kind of piece you must move. */
export const rollForInitiativeDef: ModifierDefinition = {
  id: ID,
  name: 'Roll For Initiative',
  category: 'B',
  pointCost: -2,
  curseRating: 2,
  activeFor: 'both',
  draftScope: 'owned',
  ...moveRuleHooks(ID),

  onTurnStart(state) {
    const color = state.turn;
    if (state.status !== 'active' || !affectsColor(state, ID, color)) return state;
    if (ownMoveNumber(state, color) % ROLL_EVERY !== 0) return state;
    const roll = readRoll(state);
    // beginTurn can run twice for one turn (a reload); roll once.
    if (roll && roll.color === color && roll.turnNumber === state.turnNumber) return state;
    const faces = facesFor(state, color);
    if (faces.length === 0) return state;
    const [index, prng] = prngPickIndex(state.prngState, faces.length);
    const type = faces[index];
    const next = cloneState(state);
    next.prngState = prng;
    next.modifierState = { ...next.modifierState, [ID]: { roll: { color, turnNumber: state.turnNumber, type } } };
    const squares = Array.from(next.pieces.values())
      .filter(p => p.color === color && p.type === type)
      .map(p => p.square);
    return appendGameEvent(next, {
      ply: state.moveHistory.length + 1,
      type: 'modifier',
      modifierId: ID,
      title: 'ROLL FOR INITIATIVE',
      message: `The die says ${pieceName(type)}. ${color === 'white' ? 'White' : 'Black'} must move ${aPiece(type)} if one can move.`,
      squares,
    });
  },
};
