import { describe, expect, it } from 'vitest';
import type { PieceType } from '@pigeon-chess/game-core';
import { hasPieceArt } from './PieceArt';

const TYPES: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn', 'pigeon', 'chancellor', 'royal_guard'];

describe('piece art', () => {
  it('has an SVG for every piece type', () => {
    expect(TYPES.filter(type => !hasPieceArt(type))).toEqual([]);
  });
});
