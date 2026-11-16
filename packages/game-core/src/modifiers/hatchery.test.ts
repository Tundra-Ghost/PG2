import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { isInCheck } from '../engine/moveGenerator';
import { getValidOptions, pickBlocker } from '../draft/rules';
import type { GameState } from '../engine/types';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { EGG_ROUNDS, getEggRoundsLeft, hatcheryDef } from './definitions/hatchery';
import { hatofulGambitDef, PIGEON_HOP_PLIES, PIGEON_WARNING_PLIES } from './definitions/hatoful-gambit';
import { makeEmptyState, makePiece, move } from './testHelpers';

const HATCH = MODIFIER_IDS.hatchery;

/** Kings shuffle a1-b1 and h8-g8 so only the Egg's count changes. */
function shuffleRounds(state: GameState, rounds: number): GameState {
  let next = state;
  for (let i = 0; i < rounds; i++) {
    const w = next.pieces.get('a1')?.type === 'king' ? ['a1', 'b1'] : ['b1', 'a1'];
    next = chessEngine.applyMove(next, move(w[0] as 'a1', w[1] as 'b1', 'white'));
    const b = next.pieces.get('h8')?.type === 'king' ? ['h8', 'g8'] : ['g8', 'h8'];
    next = chessEngine.applyMove(next, move(b[0] as 'h8', b[1] as 'g8', 'black'));
  }
  return next;
}

function withHatchery(extra = [] as ReturnType<typeof makePiece>[], owner: 'white' | 'black' = 'white'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'black', 'a7'), ...extra]),
    [{ id: HATCH, sourceColor: owner }],
  );
}

describe('MOD-E016 Hatchery', () => {
  it('lays an Egg on the owner\'s d3, or d6 for Black', () => {
    const white = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: HATCH, sourceColor: 'white' }]);
    expect(white.pieces.get('d3')).toMatchObject({ type: 'egg', color: 'white' });
    expect(getEggRoundsLeft(white.pieces.get('d3')!)).toBe(EGG_ROUNDS);
    const black = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: HATCH, sourceColor: 'black' }]);
    expect(black.pieces.get('d6')).toMatchObject({ type: 'egg', color: 'black' });
    expect(black.pieces.has('d3')).toBe(false);
  });

  it('uses the nearest empty square on that rank when d3 is taken', () => {
    const state = withHatchery([makePiece('knight', 'white', 'd3'), makePiece('pawn', 'white', 'e3')]);
    expect(state.pieces.get('c3')?.type).toBe('egg');
  });

  it('cannot move, gives no check, but blocks and can be captured', () => {
    const state = withHatchery();
    expect(chessEngine.getLegalMoves(state, 'd3')).toEqual([]);
    expect(chessEngine.validateMove(state, move('d3', 'd4', 'white')).valid).toBe(false);

    // A black King right next to the Egg is not in check.
    const near = withHatchery();
    near.pieces.delete('h8');
    near.pieces.set('e4', makePiece('king', 'black', 'e4'));
    expect(isInCheck(near, 'black')).toBe(false);

    // A rook behind the Egg is blocked, and can capture it.
    const blocked = withHatchery([makePiece('rook', 'black', 'd8')]);
    blocked.turn = 'black';
    const rookMoves = chessEngine.getLegalMoves(blocked, 'd8');
    expect(rookMoves).toContain('d3');
    expect(rookMoves).not.toContain('d2');
    const taken = chessEngine.applyMove(blocked, move('d8', 'd3', 'black'));
    expect(taken.pieces.get('d3')?.type).toBe('rook');
  });

  it('counts down on the owner\'s moves and hatches into a Pigeon after 10 of them', () => {
    let state = withHatchery();
    state = shuffleRounds(state, EGG_ROUNDS - 1);
    expect(state.pieces.get('d3')?.type).toBe('egg');
    expect(getEggRoundsLeft(state.pieces.get('d3')!)).toBe(1);
    state = shuffleRounds(state, 1);
    const pigeon = state.pieces.get('d3')!;
    expect(pigeon.type).toBe('pigeon');
    expect(pigeon.cooldowns[HATCH]).toBeUndefined();
    expect(state.eventHistory.some(e => e.modifierId === HATCH && /hatches/.test(e.message))).toBe(true);
    expect(chessEngine.getLegalMoves(state, 'd3').sort()).toEqual(['b2', 'b4', 'c1', 'c5', 'e1', 'e5', 'f2', 'f4']);
  });

  it('ignores the opponent\'s moves for the count', () => {
    let state = withHatchery([], 'black');
    state = shuffleRounds(state, 3);
    expect(getEggRoundsLeft(state.pieces.get('d6')!)).toBe(EGG_ROUNDS - 3);
  });

  it('hatches only right after its owner moves, so it never checks the side not to move', () => {
    let state = withHatchery();
    state = shuffleRounds(state, EGG_ROUNDS - 1);
    // A black King on e5 would be checked by a Pigeon on d3. It hatches as White moves.
    state.pieces.delete('h8');
    state.pieces.delete('g8');
    state.pieces.set('e5', makePiece('king', 'black', 'e5'));
    const from = state.pieces.get('a1')?.type === 'king' ? 'a1' : 'b1';
    state = chessEngine.applyMove(state, move(from, from === 'a1' ? 'b1' : 'a1', 'white'));
    expect(state.pieces.get('d3')?.type).toBe('pigeon');
    expect(state.turn).toBe('black');
    expect(isInCheck(state, 'black')).toBe(true);
    expect(isInCheck(state, 'white')).toBe(false);
  });

  it('a hatched Pigeon hops only when its side drafted Hatoful Gambit', () => {
    const pigeonState = (owner: 'white' | 'black') => {
      const state = makeEmptyState([
        makePiece('king', 'white', 'h1'),
        makePiece('king', 'black', 'a8'),
        makePiece('pigeon', 'white', 'd4', 'p1'),
      ]);
      state.activeModifiers = [{ id: MODIFIER_IDS.hatofulGambit, name: 'Hatoful', activeFor: 'both', sourceColor: owner }];
      state.moveHistory = Array.from({ length: PIGEON_HOP_PLIES - PIGEON_WARNING_PLIES - 1 }, () => ({
        move: move('a2', 'a3', 'white'),
        pieceMoved: makePiece('pawn', 'white', 'a2'),
        notation: 'a3',
      }));
      return hatofulGambitDef.onPostMove!(state, move('h1', 'h1', 'white'));
    };
    expect(Object.keys((pigeonState('white').modifierState[MODIFIER_IDS.hatofulGambit] as { plans: object }).plans)).toEqual(['p1']);
    expect(Object.keys((pigeonState('black').modifierState[MODIFIER_IDS.hatofulGambit] as { plans: object }).plans)).toEqual([]);
  });

  it('with Hatoful Gambit the flock grows to three', () => {
    let state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: MODIFIER_IDS.hatofulGambit, sourceColor: 'white' },
      { id: HATCH, sourceColor: 'white' },
    ]);
    state.pieces.get('d3')!.cooldowns[HATCH] = 1;
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    const pigeons = Array.from(state.pieces.values()).filter(p => p.type === 'pigeon' && p.color === 'white');
    expect(pigeons).toHaveLength(3);
  });

  it('an Egg bought back with Moneyball starts a fresh count', () => {
    const state = withHatchery();
    const egg = state.pieces.get('d3')!;
    state.pieces.set('d3', { ...egg, cooldowns: {} });
    const next = hatcheryDef.onPostMove!(state, move('a1', 'b1', 'white'));
    expect(getEggRoundsLeft(next.pieces.get('d3')!)).toBe(EGG_ROUNDS);
  });

  it('is never picked by Gerald, the Berserker or a Sus disguise', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const start = makeEmptyState([
        makePiece('king', 'white', 'a1'),
        makePiece('king', 'black', 'h8'),
        makePiece('rook', 'white', 'h1'),
      ]);
      start.prngSeed = seed;
      start.prngState = seed;
      const state = chessEngine.activateDraftModifiers(start, [
        { id: HATCH, sourceColor: 'white' },
        { id: MODIFIER_IDS.berserker, sourceColor: 'white' },
        { id: MODIFIER_IDS.sus, sourceColor: 'white' },
      ]);
      const egg = state.pieces.get('d3')!;
      expect(egg.type).toBe('egg');
      expect(egg.isBerserker, `seed ${seed}`).toBeFalsy();
      const sus = state.modifierState[MODIFIER_IDS.sus] as { white?: { pieceId: string } };
      expect(sus.white?.pieceId, `seed ${seed}`).not.toBe(egg.id);
    }
  });

  it('cannot be drafted with The Small Council on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === HATCH)!;
    expect(getValidOptions([MODIFIER_IDS.smallCouncil], [], built).map(c => c.id)).not.toContain(HATCH);
    expect(pickBlocker(card, [MODIFIER_IDS.smallCouncil], [], built)).toBe('Does not work with The Small Council.');
    expect(getValidOptions([], [MODIFIER_IDS.smallCouncil], built).map(c => c.id)).toContain(HATCH);
  });
});
