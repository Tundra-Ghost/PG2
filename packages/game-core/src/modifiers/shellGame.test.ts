import { describe, expect, it } from 'vitest';
import './index';
import { MODIFIER_IDS } from './ids';
import { getOwnCups, isCup } from './definitions/shell-game';
import { getShownType } from './definitions/sus';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { chessEngine } from '../engine/ChessEngine';
import { botView } from '../engine/bot';
import { getValidOptions } from '../draft/rules';
import type { GameState } from '../engine/types';

function start(): GameState {
  const s = chessEngine.getInitialState();
  s.prngState = 11;
  return chessEngine.activateDraftModifiers(s, [{ id: MODIFIER_IDS.shellGame, sourceColor: 'white' }]);
}

function small(): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState([
    makePiece('king', 'white', 'h1'),
    makePiece('queen', 'white', 'd1'),
    makePiece('pawn', 'white', 'a2'),
    makePiece('pawn', 'white', 'b2'),
    makePiece('king', 'black', 'h8'),
    makePiece('rook', 'black', 'c8'),
  ]), [{ id: MODIFIER_IDS.shellGame, sourceColor: 'white' }]);
}

describe('Shell Game', () => {
  it('puts the Queen and two pawns under cups, never the King, only for the opponent', () => {
    const s = start();
    const cups = getOwnCups(s, 'white');
    expect(cups).toHaveLength(3);
    expect(cups).toContain('d1');
    const types = cups.map(sq => s.pieces.get(sq)!.type).sort();
    expect(types).toEqual(['pawn', 'pawn', 'queen']);
    const queen = s.pieces.get('d1')!;
    expect(isCup(s, queen, 'black')).toBe(true);
    expect(isCup(s, queen, 'white')).toBe(false);
    expect(getShownType(s, queen, 'black')).toBe('pawn');
    expect(isCup(s, s.pieces.get('e1')!, 'black')).toBe(false);
  });

  it('picks the same pawns from the same seed', () => {
    expect(getOwnCups(start(), 'white')).toEqual(getOwnCups(start(), 'white'));
  });

  it('lifts a cup when its piece moves, with an event naming it', () => {
    const next = chessEngine.applyMove(small(), move('d1', 'd4', 'white'));
    expect(isCup(next, next.pieces.get('d4')!, 'black')).toBe(false);
    expect(next.eventHistory[next.eventHistory.length - 1].message).toContain('white queen');
    expect(getOwnCups(next, 'white').sort()).toEqual(['a2', 'b2']);
  });

  it('lifts a cup when an enemy piece attacks it', () => {
    const s = small();
    s.turn = 'black';
    const next = chessEngine.applyMove(s, move('c8', 'c2', 'black'));
    // The rook on c2 attacks the b2 cup (and stops there), but not a2 or d1.
    expect(getOwnCups(next, 'white').sort()).toEqual(['a2', 'd1']);
    expect(next.eventHistory[next.eventHistory.length - 1].message).toContain('under attack');
  });

  it('bots read a cup as a pawn', () => {
    const s = small();
    const view = botView(s, 'black');
    expect(view.pieces.get('d1')!.type).toBe('pawn');
    expect(s.pieces.get('d1')!.type).toBe('queen');
  });

  it('a capture of a cup still captures the real piece', () => {
    const s = small();
    s.turn = 'black';
    s.pieces.set('d8', makePiece('rook', 'black', 'd8'));
    s.pieces.delete('c8');
    // d8 attacks d1 already, so the queen cup is lifted at the start of the turn.
    const begun = chessEngine.beginTurn(s);
    expect(getOwnCups(begun, 'white')).not.toContain('d1');
    const next = chessEngine.applyMove(begun, move('d8', 'd1', 'black'));
    expect(next.moveHistory[0].pieceCaptured?.type).toBe('queen');
  });

  it('cannot be drafted with Sus, Three Kings, Main Character Syndrome or Imposter Syndrome', () => {
    for (const other of [MODIFIER_IDS.sus, MODIFIER_IDS.threeKings, MODIFIER_IDS.mainCharacterSyndrome, MODIFIER_IDS.imposterSyndrome]) {
      const ids = getValidOptions([other], [], new Set([MODIFIER_IDS.shellGame]), { unlimited: true }).map(c => c.id);
      expect(ids).not.toContain(MODIFIER_IDS.shellGame);
    }
  });
});
