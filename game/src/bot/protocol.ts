import { getChickBotMove, getPigeonBotMove, type Color, type GameState, type Move } from '@pigeon-chess/game-core';
import type { BotId } from '../opponents';

export interface BotRequest {
  id: number;
  bot: BotId;
  color: Color;
  state: GameState;
}

export interface BotReply {
  id: number;
  move: Move | null;
}

/** Bots without their own engine yet play as Chick. */
export function pickBotMove(bot: BotId, state: GameState, color: Color): Move | null {
  return bot === 'pigeon' ? getPigeonBotMove(state, color) : getChickBotMove(state, color);
}
