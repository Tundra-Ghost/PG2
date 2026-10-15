import { describe, expect, it } from 'vitest';
import { chessEngine } from './ChessEngine';
import { drawByAgreement, getWinner, resign } from './result';

const start = () => chessEngine.beginTurn(chessEngine.getInitialState());

describe('match results', () => {
  it('resigning ends the game for the other side', () => {
    const state = resign(start(), 'white');
    expect(state.status).toBe('resigned');
    expect(state.resignedBy).toBe('white');
    expect(getWinner(state)).toBe('black');
  });

  it('a draw by agreement ends the game as a draw', () => {
    const state = drawByAgreement(start());
    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('agreement');
    expect(getWinner(state)).toBe('draw');
  });

  it('a finished game cannot be resigned or drawn again', () => {
    const resigned = resign(start(), 'black');
    expect(resign(resigned, 'white')).toBe(resigned);
    expect(drawByAgreement(resigned)).toBe(resigned);
  });

  it('no moves are accepted after a resignation', () => {
    const state = resign(start(), 'black');
    const move = { from: 'e2', to: 'e4', playerColor: 'white' } as const;
    expect(chessEngine.validateMove(state, move).valid).toBe(false);
  });

  it('an active game has no winner', () => {
    expect(getWinner(start())).toBeNull();
  });
});
