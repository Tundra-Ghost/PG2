import { describe, expect, it } from 'vitest';
import { createEmptyPuzzle } from '@pigeon-chess/game-core';
import { deletePuzzle, readPuzzles, savePuzzle } from './puzzleStore';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('puzzleStore', () => {
  it('saves, replaces and deletes puzzles, newest first', () => {
    const store = memoryStore();
    const a = { ...createEmptyPuzzle('a'), title: 'A' };
    const b = { ...createEmptyPuzzle('b'), title: 'B' };
    savePuzzle(a, store);
    savePuzzle(b, store);
    expect(readPuzzles(store).map(p => p.title)).toEqual(['B', 'A']);

    savePuzzle({ ...a, title: 'A2' }, store);
    expect(readPuzzles(store).map(p => p.title)).toEqual(['A2', 'B']);

    expect(deletePuzzle('b', store).map(p => p.id)).toEqual(['a']);
  });

  it('skips damaged entries', () => {
    const store = memoryStore();
    store.setItem('pigeon-chess-puzzles', JSON.stringify([{ id: 'x', code: 'junk' }, { id: 1 }]));
    savePuzzle(createEmptyPuzzle('ok'), store);
    expect(readPuzzles(store).map(p => p.id)).toEqual(['ok']);
  });

  it('survives storage that is missing', () => {
    expect(readPuzzles(null)).toEqual([]);
    expect(savePuzzle(createEmptyPuzzle('z'), null)).toEqual([]);
  });
});
