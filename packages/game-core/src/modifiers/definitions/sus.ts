import type { ModifierDefinition } from '../types';
import type { Color, GameState, MoveRecord, Piece, PieceType } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { prngPickIndex } from '../../engine/prng';
import { MODIFIER_IDS } from '../ids';
import { getModifierOwner } from '../owner';

const ID = MODIFIER_IDS.sus;
/** Types a disguise can show. Special pieces from other cards are never shown. */
const DISGUISES: PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
const LETTERS: Partial<Record<PieceType, string>> = { knight: 'N', bishop: 'B', rook: 'R', queen: 'Q' };

interface Disguise {
  pieceId: string;
  shownAs: PieceType;
}

type SusState = Partial<Record<Color, Disguise>>;

function sus(state: GameState): SusState {
  return (state.modifierState[ID] as SusState | undefined) ?? {};
}

function pieceName(type: PieceType): string {
  return type.replace('_', ' ');
}

/** The disguised piece of `color`, if it is still disguised. */
export function getSusPiece(state: GameState, color: Color): Disguise | null {
  return sus(state)[color] ?? null;
}

/**
 * The type `viewer` sees for `piece`. The owner sees the truth; the
 * opponent sees the disguise while it lasts.
 */
export function getShownType(state: GameState, piece: Piece, viewer: Color): PieceType {
  if (piece.color === viewer) return piece.type;
  const disguise = sus(state)[piece.color];
  return disguise && disguise.pieceId === piece.id ? disguise.shownAs : piece.type;
}

/** Move-log text for `viewer`: a disguised piece's moves use its fake letter. */
export function getShownNotation(state: GameState, record: MoveRecord, viewer: Color): string {
  const { pieceMoved, move } = record;
  if (pieceMoved.color === viewer) return record.notation;
  const disguise = sus(state)[pieceMoved.color];
  if (!disguise || disguise.pieceId !== pieceMoved.id || move.ability || move.promotion) return record.notation;
  const capture = record.pieceCaptured !== undefined || record.notation.includes('x');
  const suffix = record.notation.match(/[+#]+$/)?.[0] ?? '';
  const letter = LETTERS[disguise.shownAs];
  if (!letter) return `${capture ? `${move.from[0]}x` : ''}${move.to}${suffix}`;
  return `${letter}${capture ? 'x' : ''}${move.to}${suffix}`;
}

function unmask(state: GameState, color: Color, piece: Piece, square: string, reason: string): GameState {
  const disguise = sus(state)[color]!;
  const next = cloneState(state);
  const rest = { ...sus(state) };
  delete rest[color];
  next.modifierState = { ...next.modifierState, [ID]: rest };
  return appendGameEvent(next, {
    ply: state.moveHistory.length + 1,
    type: 'modifier',
    modifierId: ID,
    title: 'Sus',
    squares: [square as Piece['square']],
    message: `The ${pieceName(disguise.shownAs)} on ${square} was Sus. It was really a ${color} ${pieceName(piece.type)}. ${reason}`,
  });
}

/**
 * MOD-D005: one of the owner's pieces (never the King) looks like another
 * type to the opponent. It moves like its true self, so the opponent can
 * work it out. The disguise lasts until the piece is captured or promotes.
 */
export const susDef: ModifierDefinition = {
  id: ID,
  name: 'Sus (One Of These Is Lying)',
  category: 'D',
  pointCost: 3,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  onActivate(state) {
    const owners: Color[] = [];
    const owner = getModifierOwner(state, ID);
    if (owner) owners.push(owner);
    else owners.push('white', 'black');
    let next = cloneState(state);
    for (const color of owners) {
      const candidates = [...next.pieces.values()]
        .filter(piece => piece.color === color && piece.type !== 'king' && !piece.isRealKing)
        .sort((a, b) => a.id.localeCompare(b.id));
      if (candidates.length === 0) continue;
      const [pieceIdx, prngA] = prngPickIndex(next.prngState, candidates.length);
      const piece = candidates[pieceIdx];
      const choices = DISGUISES.filter(type => type !== piece.type);
      const [typeIdx, prngB] = prngPickIndex(prngA, choices.length);
      next.prngState = prngB;
      next.modifierState = {
        ...next.modifierState,
        [ID]: { ...sus(next), [color]: { pieceId: piece.id, shownAs: choices[typeIdx] } satisfies Disguise },
      };
    }
    return next;
  },

  onCapture(state, _move, captured) {
    const disguise = sus(state)[captured.color];
    if (!disguise || disguise.pieceId !== captured.id) return state;
    return unmask(state, captured.color, captured, captured.square, 'The disguise is gone.');
  },

  onPromotion(state, move) {
    const piece = state.pieces.get(move.to);
    if (!piece) return state;
    const disguise = sus(state)[piece.color];
    if (!disguise || disguise.pieceId !== piece.id) return state;
    return unmask(state, piece.color, { ...piece, type: 'pawn' }, move.to, 'It promotes in plain sight.');
  },
};
