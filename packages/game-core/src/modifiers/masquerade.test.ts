import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState } from '../engine/types';
import { botView } from '../engine/bot';
import { redactForViewer } from '../net/redact';
import './index';
import { MODIFIER_IDS } from './ids';
import { getMasks, isMasked } from './definitions/masquerade';
import { getShownNotation, getShownType } from './definitions/sus';
import { getValidOptions } from '../draft/rules';
import { modifierRegistry } from './registry';

const ID = MODIFIER_IDS.masquerade;

function start(extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: ID, sourceColor: null }, ...extra]));
}

const play = (state: GameState, from: string, to: string) =>
  chessEngine.applyMove(state, { from: from as never, to: to as never, playerColor: state.turn });

describe('MOD-D020 Masquerade', () => {
  it('every piece but the Kings is masked for 6 rounds, then the masks come off', () => {
    let state = start();
    const knight = state.pieces.get('g1')!;
    expect(isMasked(state, knight)).toBe(true);
    expect(isMasked(state, state.pieces.get('e1')!)).toBe(false);
    expect(getShownType(state, knight, 'black')).toBe('pawn');
    expect(getShownType(state, knight, 'white')).toBe('knight');
    expect(getMasks(state)).toBe('Masquerade: masks off in 6 rounds');
    const moves: [string, string][] = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    for (let i = 0; i < 12; i++) {
      state.positionHistory = {};
      const [from, to] = moves[i % 4];
      state = play(state, from, to);
    }
    expect(state.flags.fullMoveNumber).toBe(7);
    expect(isMasked(state, state.pieces.get('g1')!)).toBe(false);
    expect(getMasks(state)).toBeNull();
    expect(state.eventHistory.some(e => e.modifierId === ID && /come off/.test(e.message))).toBe(true);
  });

  it('pieces still move as themselves, and owners see their real moves', () => {
    const state = start();
    expect(chessEngine.getLegalMoves(state, 'g1').sort()).toEqual(['f3', 'h3']);
    expect(chessEngine.validateMove(state, { from: 'g1', to: 'g3', playerColor: 'white' }).valid).toBe(false);
  });

  it('the opponent reads a masked move by its squares only', () => {
    const state = play(start(), 'g1', 'f3');
    const record = state.moveHistory[0];
    expect(getShownNotation(state, record, 'black')).not.toMatch(/N/);
    expect(getShownNotation(state, record, 'white')).toBe('Nf3');
  });

  it('online, no true type of a masked enemy piece is sent', () => {
    const state = play(start(), 'g1', 'f3');
    const seen = redactForViewer(state, 'black');
    const white = [...seen.pieces.values()].filter(p => p.color === 'white');
    expect(new Set(white.map(p => p.type))).toEqual(new Set(['pawn', 'king']));
    expect(seen.moveHistory[0].pieceMoved.type).toBe('pawn');
    expect(seen.moveHistory[0].notation).not.toMatch(/N/);
    // Own pieces keep their types.
    expect([...seen.pieces.values()].some(p => p.color === 'black' && p.type === 'queen')).toBe(true);
  });

  it('bots read masked enemies as pawns', () => {
    const view = botView(start(), 'black');
    expect(view.pieces.get('d1')?.type).toBe('pawn');
    expect(view.pieces.get('d8')?.type).toBe('queen');
  });

  it('cannot share a match with the disguise and type-marking cards', () => {
    const ids = new Set(modifierRegistry.getAll().map(def => def.id));
    for (const other of [MODIFIER_IDS.sus, MODIFIER_IDS.shellGame, MODIFIER_IDS.mainCharacterSyndrome, MODIFIER_IDS.imposterSyndrome, MODIFIER_IDS.berserker, MODIFIER_IDS.everyoneHasAPrice]) {
      expect(getValidOptions([], [other], ids).some(c => c.id === ID)).toBe(false);
      expect(getValidOptions([other], [], ids).some(c => c.id === ID)).toBe(false);
      expect(getValidOptions([ID], [], ids).some(c => c.id === other)).toBe(false);
    }
  });

  it('online, a masked ability move and the 50-move clock name no type', () => {
    let state = start([{ id: MODIFIER_IDS.yeet, sourceColor: 'white' }]);
    state = play(state, 'e2', 'e4');
    const seen = redactForViewer(state, 'black');
    expect(seen.flags.halfMoveClock).toBe(0);
    state.moveHistory[0] = { ...state.moveHistory[0], move: { ...state.moveHistory[0].move, ability: MODIFIER_IDS.yeet, promotion: 'queen' } };
    const record = redactForViewer(state, 'black').moveHistory[0];
    expect(record.move.ability).toBeUndefined();
    expect(record.move.promotion).toBeUndefined();
  });

  it('online, a masked piece giving check is sent as itself', () => {
    let state = start();
    for (const [from, to] of [['e2', 'e3'], ['f7', 'f6'], ['d1', 'h5']] as const) state = play(state, from, to);
    expect(chessEngine.isInCheck(state, 'black')).toBe(true);
    const seen = redactForViewer(state, 'black');
    expect(seen.pieces.get('h5')?.type).toBe('queen');
    expect(seen.pieces.get('f1')?.type).toBe('pawn');
    expect(chessEngine.isInCheck(seen, 'black')).toBe(true);
  });
});
