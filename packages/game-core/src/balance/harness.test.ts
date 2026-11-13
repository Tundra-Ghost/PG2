import { describe, expect, it } from 'vitest';
import '../modifiers/index';
import { MODIFIER_IDS } from '../modifiers/ids';
import { formatBalanceReport, isFlagged, playBalanceGame, runCardBalance } from './harness';

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
});
