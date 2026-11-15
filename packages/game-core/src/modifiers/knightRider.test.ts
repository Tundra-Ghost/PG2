import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { getChickBotMove } from '../engine/bot';
import { isInCheck } from '../engine/moveGenerator';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { getSusPiece } from './definitions/sus';
import { makeEmptyState, makePiece, move } from './testHelpers';

const RIDER = MODIFIER_IDS.knightRider;

describe('MOD-E019 Knight Rider', () => {
  it('turns only the owner\'s knights into Nightriders', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: RIDER, sourceColor: 'white' },
    ]);
    const riders = Array.from(state.pieces.values()).filter(p => p.type === 'nightrider');
    expect(riders.map(p => p.square).sort()).toEqual(['b1', 'g1']);
    expect(state.pieces.get('g8')?.type).toBe('knight');
  });

  it('repeats one jump in a line over empty landing squares and captures at the last', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('nightrider', 'white', 'a1'),
      makePiece('pawn', 'white', 'b2'), // between squares do not matter
      makePiece('rook', 'black', 'e3'),  // a1-c2-e3: capture ends the line
      makePiece('pawn', 'white', 'd5'),  // a1-b3-c5-d7: open; a1? check other lines
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'a1').sort();
    expect(moves).toEqual(['b3', 'c2', 'c5', 'd7', 'e3']);
    expect(moves).not.toContain('g4'); // beyond the capture
  });

  it('is blocked by a piece on a landing square', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('nightrider', 'white', 'a1'),
      makePiece('pawn', 'white', 'b3'),
      makePiece('pawn', 'black', 'c2'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'a1').sort()).toEqual(['c2']);
  });

  it('gives check down its line, and writes NN in move notation', () => {
    const check = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('nightrider', 'white', 'a1'),
      makePiece('king', 'black', 'g4'),
    ]);
    expect(isInCheck(check, 'black')).toBe(true);
    // A piece on a landing square in between blocks the check.
    const blocked = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('nightrider', 'white', 'a1'),
      makePiece('pawn', 'black', 'e3'),
      makePiece('king', 'black', 'g4'),
    ]);
    expect(isInCheck(blocked, 'black')).toBe(false);

    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('nightrider', 'white', 'b1'),
      makePiece('king', 'black', 'h8'),
    ]);
    const next = chessEngine.applyMove(state, move('b1', 'd5', 'white'));
    expect(next.moveHistory[0].notation).toBe('NNd5');
  });

  it('never rides if that leaves its King in check, and can block a check', () => {
    const pinned = makeEmptyState([
      makePiece('king', 'white', 'd1'),
      makePiece('nightrider', 'white', 'd3'),
      makePiece('rook', 'black', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(pinned, 'd3')).toEqual([]);

    const checked = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('nightrider', 'white', 'b8'),
      makePiece('rook', 'black', 'a7'),
      makePiece('king', 'black', 'h8'),
    ]);
    // b8-c6-d4-e2: none block the a-file; a6 does (b8-a6).
    expect(chessEngine.getLegalMoves(checked, 'b8').sort()).toEqual(['a6']);
  });

  it('bots see and use its long rides', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('nightrider', 'white', 'a1'),
      makePiece('queen', 'black', 'g4'),
      makePiece('king', 'black', 'h7'),
    ]);
    expect(getChickBotMove(state, 'white', () => 0)).toMatchObject({ from: 'a1', to: 'g4' });
  });

  it('is trapped by the Swamp, then leaves it with a single jump', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('nightrider', 'white', 'c2'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'a7'),
    ]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: null }]);
    state = chessEngine.applyMove(state, move('c2', 'e3', 'white'));
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    state = chessEngine.applyMove(state, move('e3', 'd5', 'white'));
    expect(state.pieces.get('d5')?.cooldowns[MODIFIER_IDS.thisIsMySwamp]).toBeGreaterThan(0);
    state = chessEngine.applyMove(state, move('a6', 'a5', 'black'));
    expect(chessEngine.validateMove(state, move('d5', 'e7', 'white')).valid).toBe(false);
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('a5', 'a4', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a1', 'white'));
    state = chessEngine.applyMove(state, move('a4', 'a3', 'black'));
    expect(chessEngine.validateMove(state, move('d5', 'e7', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('d5', 'f4', 'white')).valid).toBe(true);
    // Two jumps in a row (d5-f4-h3) are too far from the Swamp.
    expect(chessEngine.validateMove(state, move('d5', 'h3', 'white')).valid).toBe(false);
  });

  it('can use Did I Do That? like a knight', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('nightrider', 'white', 'b1'),
        makePiece('king', 'black', 'e8'),
      ]),
      [{ id: MODIFIER_IDS.didIDoThat, sourceColor: 'white' }],
    );
    expect(getAbilityOptions(state, 'b1')[0].targets).toContain('b5');
  });

  it('never lets a Ghost or a Sus disguise pose as a knight, whichever card comes first', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const order of [[RIDER, MODIFIER_IDS.sus, MODIFIER_IDS.ghosts], [MODIFIER_IDS.ghosts, MODIFIER_IDS.sus, RIDER]]) {
        const start = chessEngine.getInitialState();
        start.prngSeed = seed;
        start.prngState = seed;
        const state = chessEngine.activateDraftModifiers(start, order.map(id => ({ id, sourceColor: 'white' as const })));
        const white = Array.from(state.pieces.values()).filter(p => p.color === 'white');
        expect(white.some(p => p.type === 'knight'), `seed ${seed}`).toBe(false);
        const disguise = getSusPiece(state, 'white')!;
        const real = white.find(p => p.id === disguise.pieceId)!;
        expect(disguise.shownAs, `seed ${seed}`).not.toBe('knight');
        expect(disguise.shownAs, `seed ${seed}`).not.toBe(real.type);
      }
    }
  });

  it('cannot be drafted with Hatoful Gambit, The Small Council or Lawrence Of Arabia on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === RIDER)!;
    for (const other of [MODIFIER_IDS.hatofulGambit, MODIFIER_IDS.smallCouncil, MODIFIER_IDS.lawrenceOfArabia]) {
      expect(getValidOptions([other], [], built).map(c => c.id)).not.toContain(RIDER);
      expect(getValidOptions([RIDER], [], built).map(c => c.id)).not.toContain(other);
      expect(pickBlocker(card, [other], [], built)).toMatch(/^Does not work with /);
      expect(getValidOptions([], [other], built).map(c => c.id)).toContain(RIDER);
    }
  });
});
