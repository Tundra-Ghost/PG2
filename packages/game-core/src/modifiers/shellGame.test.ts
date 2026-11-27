import { describe, expect, it } from 'vitest';
import './index';
import { MODIFIER_IDS } from './ids';
import { getOwnCups, isCup } from './definitions/shell-game';
import { getShownType } from './definitions/sus';
import { getTaxedPawn } from './definitions/death-and-taxes';
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
  it('puts the Queen and two pieces from her rank under cups, never the King, only for the opponent', () => {
    const s = start();
    const cups = getOwnCups(s, 'white');
    expect(cups).toHaveLength(3);
    expect(cups).toContain('d1');
    expect(cups.every(sq => sq[1] === '1')).toBe(true);
    expect(cups).not.toContain('e1');
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

  it('a cup that gives check is lifted', () => {
    const s = chessEngine.activateDraftModifiers(makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('knight', 'white', 'd2'),
      makePiece('king', 'black', 'd8'),
    ]), [{ id: MODIFIER_IDS.shellGame, sourceColor: 'white' }]);
    expect(getOwnCups(s, 'white')).toContain('d1');
    const next = chessEngine.applyMove(s, move('d2', 'b3', 'white'));
    expect(chessEngine.isInCheck(next, 'black')).toBe(true);
    expect(getOwnCups(next, 'white')).not.toContain('d1');
  });

  it('an attacker the owner cannot see does not lift a cup', () => {
    const s = small();
    s.activeModifiers = [...s.activeModifiers, { id: MODIFIER_IDS.invisibilityCloak, name: 'Cloak', activeFor: 'both', sourceColor: 'black' }];
    s.modifierState = { ...s.modifierState, [MODIFIER_IDS.invisibilityCloak]: { black: { pieceId: 'black-rook-c8', until: 99 } } };
    s.turn = 'black';
    // The cloaked rook moves to b8, attacking the b2 cup the owner cannot see it threaten.
    const next = chessEngine.applyMove(s, move('c8', 'b8', 'black'));
    expect(getOwnCups(next, 'white').sort()).toEqual(['a2', 'b2', 'd1']);
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

  it('Death And Taxes never taxes a cup', () => {
    const s = small();
    s.pieces.set('e3', makePiece('pawn', 'white', 'e3'));
    // a2 and b2 are cups, and the Queen on d1 too: the free pawn on e3 is the one taxed.
    expect(getTaxedPawn(s, 'white')).toBe('e3');
  });

  it('cannot be drafted with Sus, Three Kings, Main Character Syndrome or Imposter Syndrome', () => {
    for (const other of [MODIFIER_IDS.sus, MODIFIER_IDS.threeKings, MODIFIER_IDS.mainCharacterSyndrome, MODIFIER_IDS.imposterSyndrome]) {
      const ids = getValidOptions([other], [], new Set([MODIFIER_IDS.shellGame]), { unlimited: true }).map(c => c.id);
      expect(ids).not.toContain(MODIFIER_IDS.shellGame);
    }
  });
});
