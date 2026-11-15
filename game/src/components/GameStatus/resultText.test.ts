import { describe, expect, it } from 'vitest';
import { chessEngine, drawByAgreement, resign, type GameState } from '@pigeon-chess/game-core';
import { getStatusMessage } from './resultText';

const vsChick = { you: 'white' as const, names: { white: 'Dusty', black: 'Chick' } };

function mated(turn: 'white' | 'black'): GameState {
  return { ...chessEngine.getInitialState(), status: 'checkmate', turn };
}

describe('getStatusMessage', () => {
  it('is null while the game is still going', () => {
    expect(getStatusMessage(chessEngine.getInitialState(), vsChick)).toBeNull();
  });

  it('says You win when the player mates the bot', () => {
    expect(getStatusMessage(mated('black'), vsChick)).toMatchObject({ headline: 'You win', sub: 'by checkmate' });
  });

  it('names the bot when it wins', () => {
    expect(getStatusMessage(mated('white'), vsChick)).toMatchObject({ headline: 'Chick wins', sub: 'by checkmate' });
  });

  it('says who resigned from the player side', () => {
    const start = chessEngine.getInitialState();
    expect(getStatusMessage(resign(start, 'white'), vsChick)).toMatchObject({
      headline: 'Chick wins',
      sub: 'You resigned',
    });
    expect(getStatusMessage(resign(start, 'black'), vsChick)).toMatchObject({
      headline: 'You win',
      sub: 'Chick resigned',
    });
  });

  it('uses colours when it does not know the sides (hot seat)', () => {
    expect(getStatusMessage(mated('black'))).toMatchObject({ headline: 'White wins' });
    expect(getStatusMessage(mated('white'))).toMatchObject({ headline: 'Black wins' });
  });

  it('online: names the opponent and calls the player You, whatever colour they are', () => {
    const asBlack = { you: 'black' as const, names: { white: 'Gerald' } };
    expect(getStatusMessage(mated('white'), asBlack)).toMatchObject({ headline: 'You win' });
    expect(getStatusMessage(mated('black'), asBlack)).toMatchObject({ headline: 'Gerald wins' });
  });

  it('never calls a resignation a checkmate', () => {
    const state: GameState = { ...chessEngine.getInitialState(), status: 'resigned', resignedBy: undefined };
    expect(getStatusMessage(state)?.sub).toBe('by resignation');
  });

  it('says Draw for a draw', () => {
    expect(getStatusMessage(drawByAgreement(chessEngine.getInitialState()), vsChick)).toMatchObject({
      headline: 'Draw',
      sub: 'by agreement',
    });
  });
});
