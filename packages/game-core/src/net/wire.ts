import type { GameState, Piece, Square, TileState } from '../engine/types';

/**
 * JSON-safe GameState. Maps become entry arrays so the state survives
 * Socket.IO, Redis, and replay storage without losing pieces or tiles.
 */
export interface WireGameState extends Omit<GameState, 'pieces' | 'tiles'> {
  pieces: Array<[Square, Piece]>;
  tiles: Array<[Square, TileState]>;
}

export function toWire(state: GameState): WireGameState {
  return {
    ...state,
    pieces: Array.from(state.pieces.entries()),
    tiles: Array.from(state.tiles.entries()),
  };
}

export function fromWire(wire: WireGameState): GameState {
  return {
    ...wire,
    pieces: new Map(wire.pieces),
    tiles: new Map(wire.tiles),
  };
}
