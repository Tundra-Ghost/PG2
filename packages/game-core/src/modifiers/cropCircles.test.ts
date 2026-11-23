import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { CROP, isInCropCircle } from './definitions/crop-circles';
import { cannonTargets } from './definitions/for-the-emperor';
import { getBestCaptureTarget } from './definitions/berserker';
import { timedPhase } from './timed';
import { getValidOptions } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const CROP_ID = MODIFIER_IDS.cropCircles;

function withCrop(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: CROP_ID, sourceColor: 'white' }, ...extra]));
}

/** Kings shuffle a1-a2 and h8-h7 until turnNumber reaches `target`. */
function playTo(state: GameState, target: number): GameState {
  const steps: Record<string, Square> = { a1: 'a2', a2: 'a1', h8: 'h7', h7: 'h8' };
  while (state.turnNumber < target) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn)!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

/** The circle's squares once it is active. */
function circle(state: GameState): Square[] {
  return (state.modifierState[CROP_ID] as { squares: Square[] }).squares;
}

/**
 * Pieces on every middle square so whichever block the seed picks holds a
 * black knight, with white rooks on rank 1 and 2 to attack it.
 */
const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

describe('MOD-A019 Crop Circles', () => {
  it('schedule: shown on turns 15-16, active 17-22, gone on 23', () => {
    expect(timedPhase(14, CROP)).toBeNull();
    expect(timedPhase(15, CROP)).toBe('warning');
    expect(timedPhase(17, CROP)).toBe('active');
    expect(timedPhase(22, CROP)).toBe('active');
    expect(timedPhase(23, CROP)).toBeNull();
  });

  it('a 3x3 on ranks 3 to 6 is shown a round ahead, then protects, then fades', () => {
    let state = withCrop([...KINGS(), makePiece('pawn', 'white', 'h2'), makePiece('pawn', 'black', 'a7')]);
    state = playTo(state, 15);
    const squares = circle(state);
    expect(squares).toHaveLength(9);
    expect(squares.every(sq => Number(sq[1]) >= 3 && Number(sq[1]) <= 6)).toBe(true);
    expect(state.tiles.get(squares[0])?.cropCircle).toBe('warning');
    expect(isInCropCircle(state, squares[0])).toBe(false);
    state = playTo(state, 17);
    expect(circle(state)).toEqual(squares);
    expect(isInCropCircle(state, squares[4])).toBe(true);
    state = playTo(state, 23);
    expect(isInCropCircle(state, squares[4])).toBe(false);
    expect(state.tiles.get(squares[0])).toBeUndefined();
  });

  it('pieces inside cannot be captured, but can move and capture out', () => {
    let state = withCrop([...KINGS(), makePiece('pawn', 'white', 'h2'), makePiece('pawn', 'black', 'a7')]);
    state = playTo(state, 17);
    const [, , , , centre] = circle(state);
    const file = centre[0];
    // A black knight in the centre of the circle and a white rook below it.
    const pieces = new Map(state.pieces);
    pieces.set(centre, makePiece('knight', 'black', centre));
    pieces.set(`${file}1` as Square, makePiece('rook', 'white', `${file}1` as Square));
    state = { ...state, pieces };
    expect(chessEngine.validateMove(state, move(`${file}1` as Square, centre, 'white')).valid).toBe(false);
    // The knight can still capture out: a white pawn two ranks below and one file over.
    const files = 'abcdefgh';
    const out = `${files[files.indexOf(file) + 1]}${Number(centre[1]) - 2}` as Square;
    const withPawn = { ...state, turn: 'black' as const, pieces: new Map(state.pieces) };
    withPawn.pieces.set(out, makePiece('pawn', 'white', out));
    expect(chessEngine.validateMove(withPawn, move(centre, out, 'black')).valid).toBe(true);
    // A Berserker chain cannot take a circle piece either.
    expect(getBestCaptureTarget(state, `${file}1` as Square)).toBeNull();
  });

  it('a King in the circle is still in check normally', () => {
    let state = withCrop([...KINGS(), makePiece('pawn', 'white', 'h2'), makePiece('pawn', 'black', 'a7')]);
    state = playTo(state, 17);
    const [, , , , centre] = circle(state);
    const pieces = new Map(state.pieces);
    pieces.delete('a1');
    pieces.delete('a2');
    pieces.set(centre, makePiece('king', 'white', centre));
    pieces.set(`${centre[0]}8` as Square, makePiece('rook', 'black', `${centre[0]}8` as Square));
    state = { ...state, pieces };
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
  });

  it('the FOR THE EMPEROR cannonball passes over circle pieces (synergy)', () => {
    let state = withCrop([...KINGS(), makePiece('pawn', 'white', 'h2'), makePiece('pawn', 'black', 'a7')], [{ id: MODIFIER_IDS.forTheEmperor, sourceColor: 'white' }]);
    state = playTo(state, 17);
    const sqs = circle(state);
    const file = sqs[4][0];
    const pieces = new Map(state.pieces);
    pieces.set(sqs[4], makePiece('knight', 'black', sqs[4]));
    pieces.set(`${file}7` as Square, makePiece('bishop', 'black', `${file}7` as Square));
    const rook = makePiece('rook', 'white', `${file}1` as Square);
    pieces.set(rook.square, rook);
    state = { ...state, pieces };
    const targets = cannonTargets(state, rook);
    expect(targets).not.toContain(sqs[4]);
  });

  it('shares squares with The Birds, the Swamp and the tide: one per match', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    const ids = getValidOptions([], [CROP_ID], built).map(c => c.id);
    expect(ids).not.toContain(MODIFIER_IDS.theBirds);
    expect(ids).not.toContain(MODIFIER_IDS.thisIsMySwamp);
    expect(ids).not.toContain(MODIFIER_IDS.tideGoesIn);
  });
});
