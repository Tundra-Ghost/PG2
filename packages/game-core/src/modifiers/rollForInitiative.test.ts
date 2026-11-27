import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { listBotMoves } from '../engine/bot';
import type { Color, GameState, Move, Piece, PieceType, Square } from '../engine/types';
import './index';
import { getShooBlocker } from '../engine/gameLoop';
import { MODIFIER_IDS } from './ids';
import { getInitiativeRoll, mustMoveRolledType } from './definitions/roll-for-initiative';
import { touchPiece } from './definitions/commitment-issues';
import { pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { ownMoveNumber } from './owner';

const RFI = MODIFIER_IDS.rollForInitiative;

function startWith(seed: number): GameState {
  const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: RFI, sourceColor: 'white' }]);
  state.prngSeed = seed;
  state.prngState = seed;
  return chessEngine.beginTurn(state);
}

function play(state: GameState, moves: Array<[Square, Square]>): GameState {
  let next = state;
  for (const [from, to] of moves) {
    const m: Move = { from, to, playerColor: next.turn };
    const result = chessEngine.validateMove(next, m);
    if (!result.valid) throw new Error(`${from}-${to}: ${result.reason}`);
    next = chessEngine.applyMove(next, m);
  }
  return next;
}

/** A position on white's 4th move with the die already showing `type`. */
function rolled(pieces: Piece[], type: PieceType, color: Color = 'white'): GameState {
  const state = chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id: RFI, sourceColor: color }],
  );
  state.turnNumber = 7;
  state.modifierState = { ...state.modifierState, [RFI]: { roll: { color, turnNumber: 7, type } } };
  return state;
}

const OPENING: Array<[Square, Square]> = [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6']];

describe('MOD-B020 Roll For Initiative', () => {
  it('rolls on your 4th move only, from the seeded generator', () => {
    let state = startWith(7);
    state = play(state, [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6']]);
    expect(getInitiativeRoll(state, 'white')).toBeNull();
    state = play(state, [['f1', 'c4'], ['g8', 'f6']]);
    const type = getInitiativeRoll(state, 'white');
    expect(type).not.toBeNull();
    expect(state.eventHistory[state.eventHistory.length - 1]?.modifierId).toBe(RFI);
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toContain(`The die says`);
    // The same seed and moves roll the same face (saved games replay this way).
    const again = play(startWith(7), OPENING);
    expect(getInitiativeRoll(again, 'white')).toBe(type);
    expect(again.prngState).toBe(state.prngState);
  });

  it('rolls once even if the turn is begun twice', () => {
    const state = play(startWith(3), OPENING);
    const twice = chessEngine.beginTurn(state);
    expect(twice.prngState).toBe(state.prngState);
    expect(twice.eventHistory.length).toBe(state.eventHistory.length);
  });

  it('over many seeds, only rolls types you still have', () => {
    const seen = new Set<PieceType>();
    for (let seed = 1; seed <= 60; seed++) {
      const state = play(startWith(seed), OPENING);
      const type = getInitiativeRoll(state, 'white');
      expect(type).not.toBeNull();
      seen.add(type!);
    }
    expect([...seen].every(t => ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(t))).toBe(true);
    expect(seen.size).toBeGreaterThan(3);

    const bare = chessEngine.activateDraftModifiers(
      makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('rook', 'white', 'a1'), makePiece('king', 'black', 'e8')]),
      [{ id: RFI, sourceColor: 'white' }],
    );
    bare.turnNumber = 7;
    for (let seed = 1; seed <= 20; seed++) {
      const type = getInitiativeRoll(chessEngine.beginTurn({ ...bare, prngState: seed }), 'white');
      expect(['king', 'rook']).toContain(type);
    }
  });

  it('you must move a piece of the rolled type', () => {
    const state = rolled([makePiece('knight', 'white', 'b1'), makePiece('rook', 'white', 'a1')], 'knight');
    expect(mustMoveRolledType(state, 'white')).toBe(true);
    const rook = chessEngine.validateMove(state, move('a1', 'a5', 'white'));
    expect(rook.valid).toBe(false);
    expect(rook.reason).toMatch(/Roll For Initiative: the die says knight/);
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white')).valid).toBe(true);
  });

  it('if no piece of that type can move, you choose freely', () => {
    const state = rolled([
      makePiece('knight', 'white', 'a1'),
      makePiece('pawn', 'white', 'b3'),
      makePiece('pawn', 'white', 'c2'),
      makePiece('rook', 'white', 'h1'),
    ], 'knight');
    expect(chessEngine.getLegalMoves(state, 'a1')).toEqual([]);
    expect(mustMoveRolledType(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('h1', 'h5', 'white')).valid).toBe(true);
  });

  it('in check, any legal move is allowed', () => {
    const state = rolled([makePiece('knight', 'white', 'b1'), makePiece('rook', 'black', 'e5'), makePiece('rook', 'white', 'a2')], 'knight');
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(mustMoveRolledType(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('a2', 'e2', 'white')).valid).toBe(true);
  });

  it('only binds the owner', () => {
    const state = rolled([makePiece('knight', 'white', 'b1'), makePiece('rook', 'black', 'a8')], 'knight', 'white');
    state.turn = 'black';
    expect(getInitiativeRoll(state, 'black')).toBeNull();
    expect(chessEngine.validateMove(state, move('a8', 'a7', 'black')).valid).toBe(true);
  });

  it('a King roll never lets the King walk into check', () => {
    const state = rolled([makePiece('rook', 'black', 'd8'), makePiece('rook', 'black', 'f8'), makePiece('rook', 'white', 'a1')], 'king');
    expect(mustMoveRolledType(state, 'white')).toBe(true);
    expect(chessEngine.validateMove(state, move('e1', 'd1', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('e1', 'e2', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('a1', 'a2', 'white')).valid).toBe(false);
  });

  it('no Gerald shoo while the die binds you', () => {
    const state = rolled([
      makePiece('knight', 'white', 'b1'),
      { ...makePiece('rook', 'white', 'a1'), cooldowns: { [MODIFIER_IDS.gerald]: 2 } },
    ], 'knight');
    expect(getShooBlocker(state)).toMatch(/Roll For Initiative/);
  });

  it('bots only play the rolled type', () => {
    const state = rolled([makePiece('knight', 'white', 'b1'), makePiece('queen', 'white', 'd1')], 'knight');
    const moves = listBotMoves(state, 'white');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.from === 'b1')).toBe(true);
  });

  it('Commitment Issues: only a piece of the rolled type can be touched', () => {
    const state = rolled([makePiece('knight', 'white', 'b1'), makePiece('queen', 'white', 'd1')], 'knight');
    state.activeModifiers.push({ id: MODIFIER_IDS.commitmentIssues, name: 'CI', activeFor: 'both', sourceColor: 'white' });
    expect(touchPiece(state, 'd1')).toBe(state);
    expect(touchPiece(state, 'b1').pieces.get('b1')?.isTouched).toBe(true);
  });

  it('cannot be drafted with Peer Pressure or Main Character Syndrome on the same side', () => {
    const card = ALL_MODIFIERS.find(c => c.id === RFI)!;
    const all = new Set(ALL_MODIFIERS.map(c => c.id));
    expect(pickBlocker(card, [MODIFIER_IDS.peerPressure], [], all)).toMatch(/Peer Pressure/);
    expect(pickBlocker(card, [MODIFIER_IDS.mainCharacterSyndrome], [], all)).toMatch(/Main Character/);
    expect(pickBlocker(card, [], [MODIFIER_IDS.peerPressure], all)).toBeNull();
  });
  it('a pass counts as one of your moves, so it shifts the roll', () => {
    let state = startWith(5);
    state = play(state, [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6']]);
    state = chessEngine.passTurn(state);
    expect(state.turn).toBe('black');
    expect(ownMoveNumber(state, 'white')).toBe(4);
    state = play(state, [['g8', 'f6']]);
    expect(ownMoveNumber(state, 'white')).toBe(4);
    expect(getInitiativeRoll(state, 'white')).not.toBeNull();
  });

  it('a save without the counter rebuilds it, extra turns included', () => {
    let state = startWith(5);
    state.tempoTokens = { white: 1, black: 0 };
    state = play(state, [['a2', 'a3']]);
    state = chessEngine.applyMove(state, move('e7', 'e5', 'black'));
    state = chessEngine.applyMove(state, move('b2', 'b3', 'white', { extraTurn: true }));
    state = chessEngine.applyMove(state, move('c2', 'c3', 'white'));
    const old = { ...state, ownMoves: undefined };
    expect(ownMoveNumber(old, 'black')).toBe(ownMoveNumber(state, 'black'));
    expect(ownMoveNumber(old, 'white')).toBe(4);
  });

  it('names read right on phones: "an" and capital King', () => {
    const state = rolled([makePiece('archbishop', 'white', 'c1'), makePiece('rook', 'white', 'a1')], 'archbishop');
    expect(chessEngine.validateMove(state, move('a1', 'a5', 'white')).reason).toMatch(/Move an archbishop\./);
    const king = rolled([makePiece('rook', 'white', 'a1')], 'king');
    expect(chessEngine.validateMove(king, move('a1', 'a5', 'white')).reason).toMatch(/the die says King\. Move a King\./);
  });
});
