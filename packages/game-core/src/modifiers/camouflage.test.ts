import { describe, expect, it } from 'vitest';
import './index';
import { MODIFIER_IDS } from './ids';
import { camouflageDef, getCamouflageCountdown } from './definitions/camouflage';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { chessEngine } from '../engine/ChessEngine';
import { getHiddenPieceIds } from '../engine/visibility';
import { botView } from '../engine/bot';
import { getValidOptions } from '../draft/rules';
import type { GameState, Square } from '../engine/types';

const card = { id: MODIFIER_IDS.camouflage, name: 'Camouflage', activeFor: 'both' as const, sourceColor: 'white' as const };

/** White's rook on a1 sits still while the King walks. */
function setup(): GameState {
  const state = makeEmptyState([
    makePiece('king', 'white', 'h1'),
    makePiece('rook', 'white', 'a1'),
    makePiece('pawn', 'white', 'a4'),
    makePiece('king', 'black', 'h8'),
    makePiece('rook', 'black', 'b8'),
  ]);
  state.activeModifiers = [card];
  return camouflageDef.onActivate!(state);
}

const walk: Square[] = ['h1', 'h2', 'h3', 'g3', 'g2', 'f2', 'f3'];
const back: Square[] = ['b8', 'c8', 'd8', 'e8', 'f8', 'f7', 'e7'];

function play(state: GameState, rounds: number): GameState {
  let s = state;
  for (let i = 0; i < rounds; i++) {
    s = chessEngine.applyMove(s, move(walk[i], walk[i + 1], 'white'));
    s = chessEngine.applyMove(s, move(back[i], back[i + 1], 'black'));
  }
  return s;
}

describe('Camouflage', () => {
  it('hides a piece that stays still for 4 of the owner\'s moves', () => {
    let s = play(setup(), 3);
    expect(getHiddenPieceIds(s, 'black').size).toBe(0);
    expect(getCamouflageCountdown(s, 'white-rook-a1')).toBe(1);
    s = play2(s);
    expect([...getHiddenPieceIds(s, 'black')].sort()).toEqual(['white-pawn-a4', 'white-rook-a1']);
    expect(getHiddenPieceIds(s, 'white').size).toBe(0);
  });

  it('shows again when it moves, and must wait 4 more moves', () => {
    let s = play2(play(setup(), 3));
    s = chessEngine.applyMove(s, move(back[4], back[5], 'black'));
    s = chessEngine.applyMove(s, move('a1', 'a2', 'white'));
    expect(getHiddenPieceIds(s, 'black').has('white-rook-a1')).toBe(false);
    expect(getCamouflageCountdown(s, 'white-rook-a1')).toBe(4);
  });

  it('an enemy move that runs into it bumps and shows it; landing on it captures', () => {
    const s = play2(play(setup(), 3));
    s.pieces.delete('f8');
    s.pieces.set('a8', makePiece('rook', 'black', 'a8', 'black-rook-b8'));
    // Black sees an open a-file.
    expect(chessEngine.getLegalMoves(s, 'a8')).toContain('a2');
    const bumped = chessEngine.applyMove(s, move('a8', 'a2', 'black'));
    expect(bumped.turn).toBe('black');
    expect(bumped.pieces.get('a8')?.color).toBe('black');
    expect([...getHiddenPieceIds(bumped, 'black')]).toEqual(['white-rook-a1']);
    expect(getCamouflageCountdown(bumped, 'white-pawn-a4')).toBe(4);
    const taken = chessEngine.applyMove(bumped, move('a8', 'a4', 'black'));
    expect(taken.pieces.get('a4')?.color).toBe('black');
  });

  it('a still piece that gives check shows, even a discovered check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('bishop', 'white', 'a2'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.activeModifiers = [card];
    state.modifierState = { [card.id]: { 'white-rook-a1': { square: 'a1', count: 4 }, 'white-bishop-a2': { square: 'a2', count: 0 } } };
    expect(getHiddenPieceIds(state, 'black').has('white-rook-a1')).toBe(true);
    const next = chessEngine.applyMove(state, move('a2', 'b3', 'white'));
    expect(chessEngine.isInCheck(next, 'black')).toBe(true);
    expect(getHiddenPieceIds(next, 'black').size).toBe(0);
    expect(getCamouflageCountdown(next, 'white-rook-a1')).toBe(4);
  });

  it('never hides the King, or a piece that shields its King from a line attack', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('knight', 'white', 'a2'),
      makePiece('pawn', 'white', 'h2'),
      makePiece('king', 'black', 'h8'),
      makePiece('rook', 'black', 'a8'),
    ]);
    state.activeModifiers = [card];
    state.modifierState = { [card.id]: {
      'white-king-a1': { square: 'a1', count: 9 },
      'white-knight-a2': { square: 'a2', count: 9 },
      'white-pawn-h2': { square: 'h2', count: 9 },
    } };
    expect([...getHiddenPieceIds(state, 'black')]).toEqual(['white-pawn-h2']);
  });

  it('bots do not see it', () => {
    const s = play2(play(setup(), 3));
    expect(botView(s, 'black').pieces.has('a1')).toBe(false);
  });

  it('cannot be drafted with Invisibility Cloak', () => {
    const ids = getValidOptions([MODIFIER_IDS.invisibilityCloak], [], new Set([MODIFIER_IDS.camouflage]), { unlimited: true }).map(c => c.id);
    expect(ids).not.toContain(MODIFIER_IDS.camouflage);
  });
});

/** The fourth white move. */
function play2(s: GameState): GameState {
  return chessEngine.applyMove(s, move(walk[3], walk[4], 'white'));
}
