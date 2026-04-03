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
