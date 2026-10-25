/// <reference lib="webworker" />
import { pickBotMove, type BotReply, type BotRequest } from './protocol';

// GameState holds Maps, which structured clone copies as they are.
self.onmessage = (event: MessageEvent<BotRequest>) => {
  const { id, bot, color, state } = event.data;
  const reply: BotReply = { id, move: pickBotMove(bot, state, color) };
  self.postMessage(reply);
};
