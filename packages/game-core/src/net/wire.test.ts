import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { fromWire, toWire } from './wire';

describe('wire format', () => {
  it('round-trips a game state through JSON', () => {
    let state = chessEngine.getInitialState();
    state = chessEngine.applyMove(state, { from: 'e2', to: 'e4', playerColor: 'white' });

    const restored = fromWire(JSON.parse(JSON.stringify(toWire(state))));

    expect(restored.pieces.get('e4')?.type).toBe('pawn');
    expect(restored.pieces.size).toBe(32);
    expect(restored.flags.enPassantSquare).toBe('e3');
    expect(chessEngine.validateMove(restored, { from: 'e7', to: 'e5', playerColor: 'black' }).valid).toBe(true);
  });
});
