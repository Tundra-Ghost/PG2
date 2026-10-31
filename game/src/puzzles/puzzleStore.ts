import { decodePuzzle, encodePuzzle, type Puzzle } from '@pigeon-chess/game-core';

/**
 * Puzzles this browser made or imported. Stored as share codes so the saved
 * form and the shared form never drift apart.
 */
const PUZZLES_KEY = 'pigeon-chess-puzzles';
const MAX_SAVED = 100;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

interface StoredPuzzle {
  id: string;
  code: string;
}

function storage(): KeyValueStore | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function readStored(store: KeyValueStore | null): StoredPuzzle[] {
  try {
    const raw = store?.getItem(PUZZLES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is StoredPuzzle => typeof entry?.id === 'string' && typeof entry?.code === 'string',
    );
  } catch {
    return [];
  }
}

function write(entries: StoredPuzzle[], store: KeyValueStore | null): void {
  try {
    store?.setItem(PUZZLES_KEY, JSON.stringify(entries));
  } catch {
    // Storage blocked or full: the puzzle still plays, it just is not kept.
  }
}

export function newPuzzleId(): string {
  return `pz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Saved puzzles, newest first. Damaged entries are skipped. */
export function readPuzzles(store: KeyValueStore | null = storage()): Puzzle[] {
  const puzzles: Puzzle[] = [];
  for (const entry of readStored(store)) {
    try {
      puzzles.push(decodePuzzle(entry.code, entry.id));
    } catch {
      // Skip it rather than lose the whole list.
    }
  }
  return puzzles;
}

/** Adds or replaces a puzzle. The saved one moves to the top. */
export function savePuzzle(puzzle: Puzzle, store: KeyValueStore | null = storage()): Puzzle[] {
  const rest = readStored(store).filter(entry => entry.id !== puzzle.id);
  write([{ id: puzzle.id, code: encodePuzzle(puzzle) }, ...rest].slice(0, MAX_SAVED), store);
  return readPuzzles(store);
}

export function deletePuzzle(id: string, store: KeyValueStore | null = storage()): Puzzle[] {
  write(readStored(store).filter(entry => entry.id !== id), store);
  return readPuzzles(store);
}
