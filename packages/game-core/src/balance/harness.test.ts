import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';
import { chessEngine } from '../engine/ChessEngine';
import { addCompensationPawns, cardCost, compensation, formatBalanceReport, isFlagged, playBalanceGame, runCardBalance } from './harness';

const quick = { bot: 'chick' as const, maxPlies: 30 };

describe('balance harness', () => {
  it('plays a capped game to the end', () => {
    const game = playBalanceGame([MODIFIER_IDS.floorIsLava], 'white', 5, quick);
    expect(game.plies).toBeLessThanOrEqual(30);
    if (game.capped) expect(game.winner).toBeNull();
  });

  it('repeats exactly for the same seed', () => {
    const a = playBalanceGame([MODIFIER_IDS.gerald], 'black', 9, quick);
    const b = playBalanceGame([MODIFIER_IDS.gerald], 'black', 9, quick);
    expect(a).toEqual(b);
  });

  it('sums games for one card and formats a report', () => {
    const result = runCardBalance(MODIFIER_IDS.berserker, { ...quick, games: 4 });
    expect(result.wins + result.losses + result.draws).toBe(4);
    const report = formatBalanceReport([result], new Map([[MODIFIER_IDS.berserker, 'Berserker']]), { ...quick, games: 4 });
    expect(report).toContain('| MOD-');
    expect(report).toContain('Berserker');
  });

  it('flags win rates outside 40% to 60%', () => {
    const base = runCardBalance(null, { ...quick, games: 2 });
    expect(isFlagged({ ...base, winRate: 0.7 })).toBe(true);
    expect(isFlagged({ ...base, winRate: 0.5 })).toBe(false);
    expect(isFlagged({ ...base, winRate: null })).toBe(false);
  });

  it('compensates the other side for a positive cost', () => {
    const cost = cardCost(MODIFIER_IDS.stonks);
    expect(cost).toBeGreaterThan(0);
    expect(compensation([MODIFIER_IDS.stonks], 'white')).toEqual({ color: 'black', pawns: Math.ceil(cost) });
  });

  it('compensates the curse side for a negative cost', () => {
    const cost = cardCost(MODIFIER_IDS.elephantInTheRoom);
    expect(cost).toBeLessThan(0);
    expect(compensation([MODIFIER_IDS.elephantInTheRoom], 'black')).toEqual({ color: 'black', pawns: -cost });
    expect(compensation([], 'white')).toBeNull();
  });

  it('puts compensation pawns on edge squares and skips blocked ones', () => {
    const state = chessEngine.getInitialState();
    state.tiles.set('h6', { square: 'h6', effects: [], isVoid: true });
    state.tiles.set('b6', { square: 'b6', effects: [], isVent: true });
    expect(addCompensationPawns(state, 'black', 3)).toBe(3);
    expect(['a6', 'g6', 'a5'].map(sq => state.pieces.get(sq as never)?.type)).toEqual(['pawn', 'pawn', 'pawn']);
    expect(state.pieces.get('a6' as never)?.color).toBe('black');
    expect(state.pieces.has('h6' as never) || state.pieces.has('b6' as never)).toBe(false);
    // Only six squares exist, so a bigger count reports the shortfall.
    expect(addCompensationPawns(chessEngine.getInitialState(), 'white', 7)).toBe(6);
  });

  it('gives shared cards no compensation', () => {
    expect(compensation([MODIFIER_IDS.floorIsLava], 'white')).toBeNull();
  });

  it('cost compensation changes games and stays reproducible', () => {
    const opts = { ...quick, maxPlies: 40 };
    const a = runCardBalance(MODIFIER_IDS.stonks, { ...opts, games: 4 });
    const b = runCardBalance(MODIFIER_IDS.stonks, { ...opts, games: 4 });
    expect(a).toEqual(b);
    expect(a.cost).toBe(cardCost(MODIFIER_IDS.stonks));
    expect(a.compPawns).toBe(Math.ceil(a.cost));
    const plain = playBalanceGame([MODIFIER_IDS.stonks], 'white', 3, { ...opts, costAware: false });
    const comp = playBalanceGame([MODIFIER_IDS.stonks], 'white', 3, opts);
    expect(plain.extraPawns).toBe(0);
    expect(comp.extraPawns).toBe(Math.ceil(a.cost));
    expect(comp.missingPawns).toBe(0);
  });
});
