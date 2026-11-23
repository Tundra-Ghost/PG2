import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { it } from 'vitest';
import '/home/user/PG2/packages/game-core/src/modifiers/index';
import { modifierRegistry } from '/home/user/PG2/packages/game-core/src/modifiers/registry';
import { getDraftScope } from '/home/user/PG2/packages/game-core/src/modifiers/scope';
import { runCardBalance, addCompensationPawns, cardCost } from '/home/user/PG2/packages/game-core/src/balance/harness';
import { chessEngine } from '/home/user/PG2/packages/game-core/src/engine/ChessEngine';
import { getPigeonBotMove } from '/home/user/PG2/packages/game-core/src/engine/bot';
import { positionKey } from '/home/user/PG2/packages/game-core/src/engine/gameLoop';

const env = process.env;
const out = env.OUT!;
const depth = Number(env.DEPTH ?? 2);
function calib(k: number, games: number) {
  let w = 0, l = 0, d = 0;
  for (let n = 0; n < games; n++) {
    const side = n % 2 === 0 ? 'white' : 'black';
    const other = side === 'white' ? 'black' : 'white';
    let state = chessEngine.getInitialState();
    state.prngSeed = 1 + n; state.prngState = 1 + n;
    if (k > 0) { addCompensationPawns(state, other, k); state.positionHistory = { [positionKey(state)]: 1 }; }
    state = chessEngine.beginTurn(state);
    let steps = 0;
    while (state.status === 'active' && state.moveHistory.length < 160 && steps < 320) {
      steps++;
      const m = getPigeonBotMove(state, state.turn, { depth, timeBudgetMs: Infinity });
      if (m) state = chessEngine.applyMove(state, m); else state = chessEngine.passTurn(state);
    }
    const winner = state.status === 'checkmate' ? (state.turn === 'white' ? 'black' : 'white') : null;
    if (winner === side) w++; else if (winner) l++; else d++;
  }
  appendFileSync(out, JSON.stringify({ calib: k, w, l, d }) + '\n');
}
it('d2', () => {
  const done = new Set((existsSync(out) ? readFileSync(out, 'utf8') : '').split('\n').filter(Boolean).map(l => { const j = JSON.parse(l); return 'calib' in j ? 'k' + j.calib : j.id + ':' + j.costAware; }));
  const shard = Number(env.SHARD), of = Number(env.SHARDS ?? 4);
  const ks = (env.CALIB ?? '').split(',').filter(Boolean).map(Number);
  for (const k of ks) if (!done.has('k' + k)) calib(k, Number(env.CALIB_GAMES ?? 120));
  const owner = [...modifierRegistry.getAll()].map(x => x.id).sort().filter(id => getDraftScope(id) !== 'shared');
  const mine = owner.filter((_, i) => i % of === shard);
  for (const id of mine) for (const costAware of [false, true]) {
    if (!done.has(id + ':' + costAware)) {
      const r = runCardBalance(id, { games: 40, depth, bot: 'pigeon', maxPlies: 160, seed: 1, costAware });
      appendFileSync(out, JSON.stringify({ id, name: modifierRegistry.get?.(id)?.name, cost: r.cost, costAware, w: r.wins, l: r.losses, d: r.draws, skipped: r.skipped, capped: r.capped }) + '\n');
    }
  }
});
