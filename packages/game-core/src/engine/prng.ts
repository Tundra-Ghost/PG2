/**
 * Mulberry32 PRNG — fast, deterministic, good quality.
 * State is a single uint32 stored in GameState.prngState.
 * All functions are purely functional (no mutation).
 */

/** Advance PRNG by one step. Returns [float in [0,1), nextState]. */
export function prngStep(state: number): [number, number] {
  let s = (state + 0x6D2B79F5) | 0;
  let z = Math.imul(s ^ (s >>> 15), 1 | s);
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
  return [((z ^ (z >>> 14)) >>> 0) / 4294967296, s];
}

/** Pick a random integer in [0, length). Returns [index, nextState]. */
export function prngPickIndex(state: number, length: number): [number, number] {
  const [f, next] = prngStep(state);
  return [Math.floor(f * length), next];
}

/**
 * A `() => number` source in [0,1) driven by Mulberry32 from `seed`, for
 * code that takes a random function (bot tie-breaks, the random draft).
 */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    const [f, next] = prngStep(state);
    state = next;
    return f;
  };
}

/**
 * A bot's random source for one position: the game seed and PRNG state
 * mixed with the ply, so a replay of the same game gets the same bot moves.
 */
export function botRandom(state: { prngSeed: number; prngState: number; moveHistory: unknown[] }): () => number {
  return seededRandom(Math.imul(state.prngSeed, 0x85ebca6b) ^ state.prngState ^ Math.imul(state.moveHistory.length + 1, 0x9e3779b1));
}
