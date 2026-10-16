import { describe, expect, it } from 'vitest';
import { ALL_MODIFIERS, chessEngine, resign, type GameState } from '@pigeon-chess/game-core';
import { buildPostGameSurvey, isFinished, resultFor } from './survey';

const ids = (mode: 'bot' | 'online' | 'local', modifierIds: string[] = []) =>
  buildPostGameSurvey({ mode, modifierIds, result: 'win', details: {} }).map(q => q.id);

describe('post-game survey', () => {
  it('asks about the bot or the connection depending on the game', () => {
    expect(ids('bot')).toEqual(['fun', 'bot-difficulty', 'play-again', 'issues', 'other']);
    expect(ids('online')).toEqual(['fun', 'connection', 'play-again', 'issues', 'other']);
    expect(ids('local')).toEqual(['fun', 'play-again', 'issues', 'other']);
  });

  it('asks about modifiers by name only when some were in play', () => {
    const mod = ALL_MODIFIERS[0];
    const questions = buildPostGameSurvey({ mode: 'bot', modifierIds: [mod.id, mod.id], result: 'win', details: {} });
    expect(questions.find(q => q.id === 'favorite-modifier')?.options).toEqual([mod.name, 'None stood out']);
    expect(questions.find(q => q.id === 'confusing-modifiers')?.options).toEqual([mod.name]);
  });

  it('reads the result from either side, and only real endings count', () => {
    const start: GameState = chessEngine.beginTurn(chessEngine.getInitialState());
    expect(isFinished(start)).toBe(false);
    const resigned = resign(start, 'white');
    expect(isFinished(resigned)).toBe(true);
    expect(resultFor(resigned, 'white')).toBe('loss');
    expect(resultFor(resigned, 'black')).toBe('win');
    expect(isFinished({ ...start, status: 'abandoned' })).toBe(false);
  });
});
