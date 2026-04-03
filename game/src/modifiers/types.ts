import type { Color, GameState, ModifierID, Move, Piece } from '../engine/types';

export interface ModifierDefinition {
  id: ModifierID;
  name: string;
  category: 'board' | 'curse' | 'ability' | 'fog' | 'army';
  pointCost: number;     // negative = grants points (curses)
  curseRating: 0 | 1 | 2 | 3;
  activeFor: Color | 'both';
  // Phase 1: implement these hooks
  onActivate: (state: GameState) => GameState;
  onTurnStart: (state: GameState) => GameState;
  onPieceMoved: (state: GameState, move: Move) => GameState;
  onCapture: (state: GameState, move: Move, captured: Piece) => GameState;
  onMatchEnd: (state: GameState) => void;
}
