import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getMineClues, minesweeperDef } from './definitions/minesweeper';
import { invisibilityCloakDef, getCloakedPiece } from './definitions/invisibility-cloak';
import { getValidOptions } from '../draft/rules';
import { redactForViewer } from '../net/redact';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.minesweeper;
const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

function start(pieces: Piece[], extra: string[] = [], seed = 1): GameState {
  const state = makeEmptyState(pieces);
  state.prngState = seed;
  return chessEngine.activateDraftModifiers(state, [ID, ...extra].map(id => ({ id, sourceColor: 'white' as const })));
}

function mines(state: GameState): Square[] {
  return (state.modifierState[ID] as { mines: Square[] }).mines;
}

function setMines(state: GameState, list: Square[]): GameState {
  return { ...state, modifierState: { ...state.modifierState, [ID]: { mines: list, clues: [] } } };
}

describe('MOD-A014 Minesweeper', () => {
  it('places four mines with the seed: two on ranks 3-4, two on ranks 5-6, never under a piece or next to a King', () => {
    for (const seed of [1, 2, 3, 99]) {
      const state = start([...chessEngine.getInitialState().pieces.values()], [], seed);
      const list = mines(state);
      expect(list).toHaveLength(4);
      expect(new Set(list).size).toBe(4);
      expect(list.filter(sq => sq[1] === '3' || sq[1] === '4')).toHaveLength(2);
      expect(list.filter(sq => sq[1] === '5' || sq[1] === '6')).toHaveLength(2);
      expect(list.some(sq => state.pieces.has(sq))).toBe(false);
      expect(mines(start([...chessEngine.getInitialState().pieces.values()], [], seed))).toEqual(list);
    }
    const near = mines(start([makePiece('king', 'white', 'd3'), makePiece('king', 'black', 'e6')]));
    for (const sq of near) {
      for (const k of ['d3', 'e6']) {
        const far = Math.max(Math.abs(sq.charCodeAt(0) - k.charCodeAt(0)), Math.abs(Number(sq[1]) - Number(k[1])));
        expect(far).toBeGreaterThan(1);
      }
    }
  });

  it('the mines are never sent online, and are absent from tiles', () => {
    const state = start(KINGS());
    expect([...state.tiles.keys()]).toEqual([]);
    for (const viewer of ['white', 'black'] as const) {
      expect(JSON.stringify(redactForViewer(state, viewer).modifierState[ID])).not.toMatch(/mines/);
    }
  });

  it('a piece that stops on a mine is lost and the mine is used up', () => {
    let state = setMines(start([...KINGS(), makePiece('knight', 'white', 'g1'), makePiece('pawn', 'black', 'a7')]), ['f3', 'c6', 'b4', 'g6']);
    state = chessEngine.applyMove(state, move('g1', 'f3', 'white'));
    expect(state.pieces.get('f3')).toBeUndefined();
    expect(mines(state)).toEqual(['c6', 'b4', 'g6']);
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'Mine!', squares: ['f3'] });
  });

  it('a piece that stops next to mines shows how many touch it; numbers update when a mine is used', () => {
    let state = setMines(start([...KINGS(), makePiece('rook', 'white', 'e1'), makePiece('rook', 'black', 'h5'), makePiece('pawn', 'black', 'a7')]), ['d4', 'f4', 'c6', 'g6']);
    state = chessEngine.applyMove(state, move('e1', 'e3', 'white'));
    expect(getMineClues(state, 'black')).toEqual([{ square: 'e3', count: 2, pieceId: 'white-rook-e1' }]);
    state = chessEngine.applyMove(state, move('h5', 'f5', 'black'));
    expect(getMineClues(state, 'white').find(c => c.square === 'f5')?.count).toBe(2);
    state = chessEngine.applyMove(state, move('e3', 'e4', 'white'));
    state = chessEngine.applyMove(state, move('f5', 'f4', 'black'));
    expect(state.pieces.get('f4')).toBeUndefined();
    const clues = getMineClues(state, 'white');
    expect(clues.find(c => c.square === 'e4')?.count).toBe(1);
    // A clue stays where it was left, and counts only live mines.
    expect(clues.find(c => c.square === 'e3')?.count).toBe(1);
  });

  it('Kings never set off a mine', () => {
    let state = setMines(start([makePiece('king', 'white', 'b2'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'black', 'a7')]), ['c3', 'c6', 'f4', 'g6']);
    state = chessEngine.applyMove(state, move('b2', 'c3', 'white'));
    expect(state.pieces.get('c3')).toMatchObject({ type: 'king' });
    expect(mines(state)).toContain('c3');
  });

  it('a mine that would leave its own King in check stays hidden', () => {
    // The knight steps onto d4, between the King on a4 and the rook on h4.
    let state = setMines(start([makePiece('king', 'white', 'a4'), makePiece('rook', 'black', 'h4'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'c2')]), ['d4', 'c6', 'f3', 'g6']);
    state = chessEngine.applyMove(state, move('c2', 'd4', 'white'));
    expect(state.pieces.get('d4')).toMatchObject({ type: 'knight' });
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);
    expect(mines(state)).toContain('d4');
  });

  it('a clue left by a hidden piece is not shown or sent to its opponent (Invisibility Cloak)', () => {
    let state = start([...KINGS(), makePiece('bishop', 'white', 'c1'), makePiece('pawn', 'black', 'a7')]);
    state.activeModifiers = [...state.activeModifiers, { id: MODIFIER_IDS.invisibilityCloak, name: 'Invisibility Cloak', activeFor: 'both', sourceColor: 'white' }];
    state = setMines(invisibilityCloakDef.onActivate!(state), ['f5', 'c6', 'b4', 'g6']);
    state = chessEngine.applyMove(state, move('c1', 'e3', 'white'));
    expect(getCloakedPiece(state, 'white')).toBe('white-bishop-c1');
    expect(getMineClues(state, 'white').map(c => c.square)).toEqual(['e3']);
    expect(getMineClues(state, 'black')).toEqual([]);
    expect((redactForViewer(state, 'black').modifierState[ID] as { clues: unknown[] }).clues).toEqual([]);
  });

  it('one per match with Vent Tiles, Let It Go and Thinking With Portals', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    for (const other of [MODIFIER_IDS.ventTiles, MODIFIER_IDS.letItGo, MODIFIER_IDS.thinkingWithPortals]) {
      expect(getValidOptions([], [other], built).map(c => c.id)).not.toContain(ID);
      expect(getValidOptions([ID], [], built).map(c => c.id)).not.toContain(other);
    }
  });

  it('a hidden piece that stops on a clue square never makes the old number vanish for its opponent', () => {
    let state = start([...KINGS(), makePiece('bishop', 'white', 'c1'), makePiece('rook', 'black', 'h3'), makePiece('pawn', 'black', 'a7')]);
    state.activeModifiers = [...state.activeModifiers, { id: MODIFIER_IDS.invisibilityCloak, name: 'Invisibility Cloak', activeFor: 'both', sourceColor: 'white' }];
    state = setMines(invisibilityCloakDef.onActivate!(state), ['f4', 'c6', 'b4', 'g6']);
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    state = chessEngine.applyMove(state, move('h3', 'e3', 'black'));
    state = chessEngine.applyMove(state, move('b1', 'a1', 'white'));
    state = chessEngine.applyMove(state, move('e3', 'e5', 'black'));
    const before = getMineClues(state, 'black').find(c => c.square === 'e3');
    expect(before?.pieceId).toBe('black-rook-h3');
    state = chessEngine.applyMove(state, move('c1', 'e3', 'white'));
    expect(getCloakedPiece(state, 'white')).toBe('white-bishop-c1');
    expect(getMineClues(state, 'black').find(c => c.square === 'e3')).toEqual(before);
    expect(getMineClues(state, 'white').find(c => c.square === 'e3')?.pieceId).toBe('white-bishop-c1');
  });

  it('a hidden piece that steps on a mine is not named', () => {
    let state = start([...KINGS(), makePiece('bishop', 'white', 'c1'), makePiece('pawn', 'black', 'a7')]);
    state.activeModifiers = [...state.activeModifiers, { id: MODIFIER_IDS.invisibilityCloak, name: 'Invisibility Cloak', activeFor: 'both', sourceColor: 'white' }];
    state = setMines(invisibilityCloakDef.onActivate!(state), ['e3', 'c6', 'b4', 'g6']);
    state = chessEngine.applyMove(state, move('c1', 'e3', 'white'));
    expect(state.pieces.get('e3')).toBeUndefined();
    const event = state.eventHistory[state.eventHistory.length - 1];
    expect(event.message).toMatch(/hidden piece/);
    expect(event.message).not.toMatch(/bishop/);
  });

  it('a piece another hook already moved on does nothing, whatever the draft order', () => {
    let state = setMines(start([...KINGS(), makePiece('knight', 'white', 'g1'), makePiece('pawn', 'black', 'a7')]), ['f3', 'c6', 'b4', 'g6']);
    // As if another card slid the knight from e2 onto the mine on f3 after its move.
    state = { ...state, modifierState: { ...state.modifierState, [ID]: { ...(state.modifierState[ID] as object), mover: 'white-knight-g1' } } };
    const knight = state.pieces.get('g1')!;
    state.pieces = new Map(state.pieces);
    state.pieces.delete('g1');
    state.pieces.set('f3', { ...knight, square: 'f3' });
    const after = minesweeperDef.onPostMove!(state, move('g1', 'e2', 'white'));
    expect(after.pieces.get('f3')).toMatchObject({ type: 'knight' });
    expect(mines(after)).toContain('f3');
    expect(getMineClues(after, null)).toEqual([]);
  });
});
