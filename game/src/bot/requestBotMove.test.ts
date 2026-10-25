import { describe, expect, it } from 'vitest';
import { chessEngine } from '@pigeon-chess/game-core';
import { requestBotMove } from './requestBotMove';

describe('requestBotMove', () => {
  it('thinks on the page when workers are not available', async () => {
    const state = chessEngine.beginTurn(chessEngine.getInitialState());
    for (const bot of ['chick', 'pigeon'] as const) {
      const move = await requestBotMove(bot, state, 'white');
      expect(move).not.toBeNull();
      expect(chessEngine.validateMove(state, move!).valid).toBe(true);
    }
  });
});
