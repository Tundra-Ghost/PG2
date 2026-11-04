import { describe, expect, it } from 'vitest';
import './index';
import { MODIFIER_IDS } from './ids';
import { getShownNotation, getShownType, getSusPiece, susDef } from './definitions/sus';
import { makeEmptyState, makePiece, move } from './testHelpers';
import type { MoveRecord } from '../engine/types';

const card = { id: MODIFIER_IDS.sus, name: 'Sus', activeFor: 'both' as const, sourceColor: 'white' as const };

function setup() {
  const state = makeEmptyState([
    makePiece('king', 'white', 'e1'),
    makePiece('knight', 'white', 'g1'),
    makePiece('king', 'black', 'e8'),
    makePiece('pawn', 'black', 'd7'),
  ]);
  state.activeModifiers = [card];
  return susDef.onActivate!(state);
}

describe('Sus', () => {
  it('disguises one of the owner\'s pieces, never the King', () => {
    const state = setup();
    const disguise = getSusPiece(state, 'white')!;
    expect(disguise.pieceId).toBe('white-knight-g1');
    expect(disguise.shownAs).not.toBe('knight');
    expect(getSusPiece(state, 'black')).toBeNull();
    const knight = state.pieces.get('g1')!;
    expect(getShownType(state, knight, 'black')).toBe(disguise.shownAs);
    expect(getShownType(state, knight, 'white')).toBe('knight');
    expect(getShownType(state, state.pieces.get('e1')!, 'black')).toBe('king');
  });

  it('shows the fake piece in the opponent\'s move log', () => {
    const state = setup();
    state.modifierState[MODIFIER_IDS.sus] = { white: { pieceId: 'white-knight-g1', shownAs: 'bishop' } };
    const record: MoveRecord = { move: move('g1', 'f3', 'white'), pieceMoved: state.pieces.get('g1')!, notation: 'Nf3+' };
    expect(getShownNotation(state, record, 'black')).toBe('Bf3+');
    expect(getShownNotation(state, record, 'white')).toBe('Nf3+');
    state.modifierState[MODIFIER_IDS.sus] = { white: { pieceId: 'white-knight-g1', shownAs: 'pawn' } };
    const capture: MoveRecord = { ...record, notation: 'Nxf3', pieceCaptured: makePiece('pawn', 'black', 'f3') };
    expect(getShownNotation(state, capture, 'black')).toBe('gxf3');
  });

  it('ends the disguise when the piece is captured', () => {
    let state = setup();
    state.modifierState[MODIFIER_IDS.sus] = { white: { pieceId: 'white-knight-g1', shownAs: 'rook' } };
    const knight = state.pieces.get('g1')!;
    state = susDef.onCapture!(state, move('g2', 'g1', 'black'), knight);
    expect(getSusPiece(state, 'white')).toBeNull();
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe('The rook on g1 was Sus. It was really a white knight. The disguise is gone.');
  });

  it('gives both sides a disguise when the card has no owner', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'e8'),
      makePiece('queen', 'black', 'd8'),
    ]);
    state.activeModifiers = [{ ...card, sourceColor: null }];
    state = susDef.onActivate!(state);
    expect(getSusPiece(state, 'white')?.pieceId).toBe('white-rook-a1');
    expect(getSusPiece(state, 'black')?.pieceId).toBe('black-queen-d8');
  });
});
