import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getValidOptions } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { getFlowArrows } from './flow';
import { getCloakedPiece } from './definitions/invisibility-cloak';

const ID = MODIFIER_IDS.magicRoundabout;

function start(pieces: Piece[], extra: string[] = []): GameState {
  const picks = [ID, ...extra].map(id => ({ id, sourceColor: 'white' as const }));
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), picks));
}

/** One full round of King shuffles (a1-b1, h8-g8). */
function round(state: GameState): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  for (let i = 0; i < 2; i++) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn && steps[p.square])!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const at = (state: GameState, sq: Square) => state.pieces.get(sq);
const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'white', 'h2')];

describe('MOD-A013 The Magic Roundabout', () => {
  it('turns pieces one step clockwise at the end of each round, not before', () => {
    let state = start([...KINGS(), makePiece('knight', 'white', 'd4')]);
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    expect(at(state, 'd4')?.type).toBe('knight');
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(at(state, 'd5')?.type).toBe('knight');
    state = round(state);
    expect(at(state, 'e5')?.type).toBe('knight');
    state = round(state);
    expect(at(state, 'e4')?.type).toBe('knight');
    state = round(state);
    expect(at(state, 'd4')?.type).toBe('knight');
  });

  it('a queue of three moves together; four pieces block each other', () => {
    let three = start([...KINGS(), makePiece('knight', 'white', 'd4'), makePiece('bishop', 'black', 'd5'), makePiece('rook', 'white', 'e5')]);
    three = round(three);
    expect(at(three, 'd5')?.type).toBe('knight');
    expect(at(three, 'e5')?.type).toBe('bishop');
    expect(at(three, 'e4')?.type).toBe('rook');
    expect(at(three, 'd4')).toBeUndefined();

    let four = start([...KINGS(), makePiece('knight', 'white', 'd4'), makePiece('bishop', 'black', 'd5'), makePiece('rook', 'white', 'e5'), makePiece('pawn', 'black', 'e4')]);
    four = round(four);
    expect(at(four, 'd4')?.type).toBe('knight');
    expect(at(four, 'e4')?.type).toBe('pawn');
  });

  it('never captures, and a King turns only to a safe square', () => {
    // Black King on e5 would turn to e4, which the white rook on a4 attacks.
    let state = start([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'e5'), makePiece('rook', 'white', 'a4'), makePiece('pawn', 'black', 'h7')]);
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    state = chessEngine.applyMove(state, move('h7', 'h6', 'black'));
    expect(at(state, 'e5')?.type).toBe('king');
    expect(at(state, 'a4')?.type).toBe('rook');
    expect(chessEngine.isInCheck(state, 'black')).toBe(false);
  });

  it('shares the centre: one per match with Swamp, Tide, Crop Circles, the Factory and Gerald\'s statue', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    for (const other of [MODIFIER_IDS.thisIsMySwamp, MODIFIER_IDS.tideGoesIn, MODIFIER_IDS.cropCircles, MODIFIER_IDS.factoryMustGrow, MODIFIER_IDS.monumentToGerald]) {
      expect(getValidOptions([], [other], built).map(c => c.id)).not.toContain(ID);
      expect(getValidOptions([ID], [], built).map(c => c.id)).not.toContain(other);
    }
  });

  it('draws arrows clockwise as White sees it', () => {
    const arrows = getFlowArrows(start(KINGS()));
    expect(Object.fromEntries(arrows)).toEqual({ d5: ['east'], e5: ['south'], e4: ['west'], d4: ['north'] });
  });

  it('a piece shielding its King stays, and a second turn start in one round does nothing', () => {
    // The white knight on e4 shields its King on e1 from the rook on e8; turning to d4 would leave the e-file.
    let state = start([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'black', 'e8'), makePiece('knight', 'white', 'e4'), makePiece('pawn', 'white', 'a2')]);
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(at(state, 'e4')?.type).toBe('knight');
    const knight = start([...KINGS(), makePiece('knight', 'white', 'd4')]);
    const once = round(knight);
    expect(at(chessEngine.beginTurn(once), 'd5')?.type).toBe('knight');
  });

  it('a hidden piece that blocks a turn is revealed, and its own new square is never flashed', () => {
    // White's only non-King piece, the knight on d5, is cloaked. It turns to e5 unseen; the black bishop follows into d5.
    const kings = [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];
    let moving = start([...kings, makePiece('knight', 'white', 'd5'), makePiece('bishop', 'black', 'd4')], [MODIFIER_IDS.invisibilityCloak]);
    const hiddenId = at(moving, 'd5')!.id;
    expect(getCloakedPiece(moving, 'white')).toBe(hiddenId);
    moving = round(moving);
    expect(getCloakedPiece(moving, 'white')).toBe(hiddenId);
    const events = moving.eventHistory.filter(e => e.modifierId === ID);
    const event = events[events.length - 1];
    expect(event.squares).not.toContain('e5');

    // Blocked: the cloaked knight on d5 cannot turn (e5 is full), so the bishop on d4 waits and reveals it.
    let blocked = start([...kings, makePiece('knight', 'white', 'd5'), makePiece('rook', 'black', 'e5'), makePiece('pawn', 'black', 'e4'), makePiece('bishop', 'black', 'd4')], [MODIFIER_IDS.invisibilityCloak]);
    blocked = round(blocked);
    expect(getCloakedPiece(blocked, 'white')).toBeNull();
  });
});
