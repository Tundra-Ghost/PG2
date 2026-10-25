import type { Color, GameState, Move } from '@pigeon-chess/game-core';
import type { BotId } from '../opponents';
import { pickBotMove, type BotReply, type BotRequest } from './protocol';

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, (move: Move | null) => void>();

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./botWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<BotReply>) => {
      pending.get(event.data.id)?.(event.data.move);
      pending.delete(event.data.id);
    };
    worker.onerror = () => {
      // Fall back to thinking on the page for this and every later move.
      workerFailed = true;
      worker?.terminate();
      worker = null;
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
    };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

/**
 * The bot's move, worked out in a Web Worker so a deep search never freezes
 * the board. Without workers it thinks on the page instead.
 */
export function requestBotMove(bot: BotId, state: GameState, color: Color): Promise<Move | null> {
  const target = getWorker();
  if (!target) return Promise.resolve(pickBotMove(bot, state, color));
  const id = nextId++;
  return new Promise(resolve => {
    pending.set(id, move => {
      // A worker crash answers null; retry once on the page so the bot still moves.
      resolve(move ?? (workerFailed ? pickBotMove(bot, state, color) : null));
    });
    const request: BotRequest = { id, bot, color, state };
    target.postMessage(request);
  });
}
