import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { getPigeonBotMove } from '../engine/bot';
import { getVisibleSquares } from '../engine/visibility';
import type { GameState, Move, Square } from '../engine/types';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { MODIFIER_IDS } from './ids';
import { getFootprints, FOOTPRINT_PLIES } from './definitions/footprints';
import { getFlashlightSquares } from './definitions/flashlight';
import { getForecast } from './definitions/crystal-ball';
import { getTells } from './definitions/tells';
import { allValidMoves } from './definitions/you-died';
import { makeEmptyState, makePiece, move } from './testHelpers';

const dark = { id: MODIFIER_IDS.darkAndScared, name: 'Dark', activeFor: 'both' as const, sourceColor: null };
const own = (id: string, color: 'white' | 'black' = 'white') => ({ id, name: id, activeFor: 'both' as const, sourceColor: color });
const implemented = new Set(ALL_MODIFIERS.map(card => card.id));
const card = (id: string) => ALL_MODIFIERS.find(c => c.id === id)!;
const offered = (ownIds: string[], otherIds: string[]) => getValidOptions(ownIds, otherIds, implemented, { unlimited: true }).map(c => c.id);

/** White sees a1 to f4 (2 squares around a1 and d2); black's rook starts on e4, in sight. */
function fogState(extra: string): GameState {
  const state = makeEmptyState([
    makePiece('king', 'white', 'a1'),
    makePiece('pawn', 'white', 'd2'),
    makePiece('king', 'black', 'h8'),
    makePiece('rook', 'black', 'e4'),
  ]);
  state.activeModifiers = [dark, own(extra)];
  return state;
}

describe('MOD-D011 Footprints', () => {
  it('marks the square an enemy left when it moves out of sight, for 2 rounds', () => {
    let state = fogState(MODIFIER_IDS.footprints);
    state.turn = 'black';
    expect(getVisibleSquares(state, 'white')!.has('e4')).toBe(true);
    state = chessEngine.applyMove(state, move('e4', 'e7', 'black'));
    expect(getFootprints(state, 'white')).toEqual(['e4']);
    expect(getFootprints(state, 'black')).toEqual([]);
    const plies = state.moveHistory.length;
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a1', 'white'));
    expect(state.moveHistory.length - plies).toBe(FOOTPRINT_PLIES - 1);
    // The king's hidden step left footprints on h8 too.
    expect(getFootprints(state, 'white').sort()).toEqual(['e4', 'h8']);
    state = chessEngine.applyMove(state, move('g8', 'h8', 'black'));
    expect(getFootprints(state, 'white')).not.toContain('e4');
  });

  it('leaves none when the enemy stays in sight, or for the owner\'s own moves', () => {
    let state = fogState(MODIFIER_IDS.footprints);
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('e4', 'e3', 'black'));
    expect(getFootprints(state, 'white')).toEqual([]);
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    expect(getFootprints(state, 'white')).toEqual([]);
    expect(getFootprints(state, 'black')).toEqual([]);
  });

  it('does nothing without fog, and is only offered once a fog card is in the match', () => {
    let state = fogState(MODIFIER_IDS.footprints);
    state.activeModifiers = [own(MODIFIER_IDS.footprints)];
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('e4', 'e7', 'black'));
    expect(getFootprints(state, 'white')).toEqual([]);
    expect(offered([], [])).not.toContain(MODIFIER_IDS.footprints);
    expect(pickBlocker(card(MODIFIER_IDS.footprints), [], [], implemented)).toMatch(/fog card/);
    expect(offered([], [MODIFIER_IDS.darkAndScared])).toContain(MODIFIER_IDS.footprints);
    expect(offered([MODIFIER_IDS.smokeCloud], [])).toContain(MODIFIER_IDS.footprints);
  });
});

describe('MOD-D012 Flashlight', () => {
  const flash = (to: Square): Move => move('a1', to, 'white', { ability: MODIFIER_IDS.flashlight });

  it('lights a 3×3 area for 1 round without using the move', () => {
    let state = fogState(MODIFIER_IDS.flashlight);
    state.pieces.delete('e4');
    state.pieces.set('g6', makePiece('rook', 'black', 'g6'));
    expect(getVisibleSquares(state, 'white')!.has('g6')).toBe(false);
    expect(chessEngine.validateMove(state, flash('f6')).valid).toBe(true);
    state = chessEngine.applyMove(state, flash('f6'));
    expect(state.turn).toBe('white');
    expect(state.moveHistory).toHaveLength(0);
    expect(state.turnNumber).toBe(1);
    const visible = getVisibleSquares(state, 'white')!;
    for (const sq of ['e5', 'f6', 'g7', 'g6', 'e7'] as const) expect(visible.has(sq)).toBe(true);
    expect(visible.has('h8')).toBe(false);
    expect(getVisibleSquares(state, 'black')!.has('c3')).toBe(false);
    // Still lit through white's move and black's reply, then dark again.
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    expect(getFlashlightSquares(state, 'white')).toHaveLength(9);
    state = chessEngine.applyMove(state, move('h8', 'h7', 'black'));
    expect(getFlashlightSquares(state, 'white')).toEqual([]);
    expect(getVisibleSquares(state, 'white')!.has('g6')).toBe(false);
  });

  it('waits 4 of your moves, and never on the edge', () => {
    let state = fogState(MODIFIER_IDS.flashlight);
    state.pieces.delete('e4');
    const option = () => getAbilityOptions(state, state.turn === 'white' ? (state.pieces.has('a1') ? 'a1' : 'b1') : 'h8').find(o => o.modifierId === MODIFIER_IDS.flashlight);
    expect(option()!.targets).not.toContain('a1');
    expect(option()!.targets).not.toContain('h5');
    expect(option()!.targets).toHaveLength(36);
    state = chessEngine.applyMove(state, flash('d5'));
    expect(chessEngine.validateMove(state, flash('e5')).valid).toBe(false);
    const path: Array<[string, string]> = [['a1', 'b1'], ['b1', 'a1'], ['a1', 'b1'], ['b1', 'a1']];
    const reply: Array<[string, string]> = [['h8', 'h7'], ['h7', 'h8'], ['h8', 'h7'], ['h7', 'h8']];
    for (let i = 0; i < 4; i++) {
      expect(option()!.cooldownLeft).toBeGreaterThan(0);
      state = chessEngine.applyMove(state, move(path[i][0] as never, path[i][1] as never, 'white'));
      state = chessEngine.applyMove(state, move(reply[i][0] as never, reply[i][1] as never, 'black'));
    }
    expect(option()!.cooldownLeft).toBe(0);
  });

  it('is never a move for stalemate or for bots', () => {
    const stuck = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'black', 'b3'),
      makePiece('king', 'black', 'h8'),
    ]);
    stuck.activeModifiers = [dark, own(MODIFIER_IDS.flashlight)];
    expect(chessEngine.hasAnyValidMove(stuck)).toBe(false);
    expect(chessEngine.isStalemate(stuck, 'white')).toBe(true);

    const state = fogState(MODIFIER_IDS.flashlight);
    for (let seed = 1; seed <= 5; seed++) {
      const botMove = getPigeonBotMove({ ...state, prngState: seed }, 'white');
      expect(botMove?.ability).not.toBe(MODIFIER_IDS.flashlight);
    }
  });

  it('never switches on a move rule, and works in check', () => {
    // The die says King, but the King cannot move: Flashlight must not count as a King move.
    let state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.darkAndScared, sourceColor: null },
      { id: MODIFIER_IDS.flashlight, sourceColor: 'white' },
      { id: MODIFIER_IDS.rollForInitiative, sourceColor: 'white' },
    ]);
    state.turnNumber = 7;
    state.modifierState = { ...state.modifierState, [MODIFIER_IDS.rollForInitiative]: { roll: { color: 'white', turnNumber: 7, type: 'king' } } };
    expect(chessEngine.hasAnyValidMove(state)).toBe(true);
    expect(chessEngine.validateMove(state, move('e2', 'e4', 'white')).valid).toBe(true);

    const check = fogState(MODIFIER_IDS.flashlight);
    check.pieces.delete('e4');
    check.pieces.set('a5', makePiece('rook', 'black', 'a5'));
    expect(chessEngine.isInCheck(check, 'white')).toBe(true);
    expect(chessEngine.validateMove(check, flash('c3')).valid).toBe(true);
  });

  it('is only offered once a fog card is in the match', () => {
    expect(offered([], [])).not.toContain(MODIFIER_IDS.flashlight);
    expect(offered([MODIFIER_IDS.knownUnknowns], [])).toContain(MODIFIER_IDS.flashlight);
  });
});

describe('MOD-D017 Crystal Ball', () => {
  it('marks where a timed event lands up to 2 rounds ahead, for its owner only', () => {
    let state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.tideGoesIn, sourceColor: null },
      { id: MODIFIER_IDS.crystalBall, sourceColor: 'white' },
    ]);
    let firstSeen = -1;
    for (let ply = 0; ply < 40 && firstSeen < 0; ply++) {
      if (getForecast(state, 'white').size > 0) firstSeen = ply;
      else state = chessEngine.applyMove(state, allValidMoves(state).find(m => !state.pieces.has(m.to))!);
    }
    expect(firstSeen).toBeGreaterThan(0);
    const forecast = getForecast(state, 'white');
    expect(getForecast(state, 'black').size).toBe(0);
    expect([...forecast.values()].every(mark => mark.title === 'Tide' && mark.rounds <= 2)).toBe(true);
    // The tide really comes within 2 rounds on those squares.
    const events = state.eventHistory.length;
    for (let i = 0; i < 4; i++) state = chessEngine.applyMove(state, allValidMoves(state).find(m => !state.pieces.has(m.to))!);
    expect(state.eventHistory.slice(events).some(e => e.modifierId === MODIFIER_IDS.tideGoesIn)).toBe(true);
    for (const sq of forecast.keys()) expect(state.tiles.get(sq)?.tide).toBeDefined();
  });

  it('never changes the real game', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.floorIsLava, sourceColor: null },
      { id: MODIFIER_IDS.crystalBall, sourceColor: 'white' },
    ]);
    const before = { prng: state.prngState, events: state.eventHistory.length, plies: state.moveHistory.length };
    getForecast(state, 'white');
    expect({ prng: state.prngState, events: state.eventHistory.length, plies: state.moveHistory.length }).toEqual(before);
  });

  it('is only offered once a timed-event card is in the match', () => {
    expect(offered([], [])).not.toContain(MODIFIER_IDS.crystalBall);
    expect(pickBlocker(card(MODIFIER_IDS.crystalBall), [], [], implemented)).toMatch(/timed/);
    expect(offered([], [MODIFIER_IDS.stormClosesIn])).toContain(MODIFIER_IDS.crystalBall);
  });
});

describe('MOD-D018 Tells', () => {
  function tellsState(): GameState {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
      makePiece('rook', 'black', 'd5'),
      makePiece('rook', 'black', 'h1'),
    ]);
    state.activeModifiers = [own(MODIFIER_IDS.tells), own(MODIFIER_IDS.yeet, 'black')];
    return state;
  }

  it('glows on a ready enemy ability and counts down the rest', () => {
    const state = tellsState();
    // d5 can YEET the d4 pawn; h1 is ready too but has nothing to shove.
    expect([...getTells(state, 'white')]).toEqual([['d5', 0]]);
    const cooling = state.pieces.get('h1')!;
    state.pieces.set('h1', { ...cooling, abilityCooldowns: { [MODIFIER_IDS.yeet]: 3 } });
    expect(getTells(state, 'white').get('h1')).toBe(3);
    expect(getTells(state, 'black').size).toBe(0);
  });

  it('judges a Sus piece by the type you see', () => {
    const state = tellsState();
    // A knight next to the d4 pawn, shown as a rook, gets the rook tell like a real rook.
    state.pieces.set('d5', makePiece('knight', 'black', 'd5'));
    state.activeModifiers.push(own(MODIFIER_IDS.sus, 'black'));
    state.modifierState[MODIFIER_IDS.sus] = { black: { pieceId: state.pieces.get('d5')!.id, shownAs: 'rook' } };
    expect(getTells(state, 'white').get('d5')).toBe(0);
  });

  it('shows nothing in the fog', () => {
    const state = tellsState();
    state.activeModifiers.push(dark);
    expect(getTells(state, 'white').has('d5')).toBe(true);
    expect(getTells(state, 'white').has('h1')).toBe(false);
  });

  it('is only offered once the opponent has an ability card', () => {
    expect(offered([], [])).not.toContain(MODIFIER_IDS.tells);
    expect(offered([MODIFIER_IDS.yeet], [])).not.toContain(MODIFIER_IDS.tells);
    expect(pickBlocker(card(MODIFIER_IDS.tells), [], [], implemented)).toMatch(/ability card/);
    expect(offered([], [MODIFIER_IDS.yeet])).toContain(MODIFIER_IDS.tells);
  });
});
