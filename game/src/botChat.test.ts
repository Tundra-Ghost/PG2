import { describe, expect, it } from 'vitest';
import { getBotReaction } from './botChat';
import type { MoveRecord, Piece } from './engine/types';

function makePiece(
  type: Piece['type'],
  color: Piece['color'],
  square: Piece['square'],
): Piece {
  return {
    id: `${color}-${type}-${square}`,
    type,
    color,
    square,
    cooldowns: {},
  };
}

function makeMoveRecord(pieceMoved: Piece, pieceCaptured?: Piece): MoveRecord {
  return {
    move: {
      from: pieceMoved.square,
      to: pieceCaptured?.square ?? pieceMoved.square,
      playerColor: pieceMoved.color,
    },
    pieceMoved,
    pieceCaptured,
    notation: 'test',
  };
}

describe('botChat', () => {
  it('returns a chick reaction when the player captures a black queen', () => {
    const reaction = getBotReaction({
      botId: 'chick',
      moveRecord: makeMoveRecord(
        makePiece('rook', 'white', 'a1'),
        makePiece('queen', 'black', 'a8'),
      ),
      moveIndex: 0,
      gameStatus: 'active',
    });

    expect(reaction).toBe('That was the important one.');
  });

  it('returns no reaction for a quiet move', () => {
    const reaction = getBotReaction({
      botId: 'chick',
      moveRecord: makeMoveRecord(makePiece('pawn', 'white', 'e4')),
      moveIndex: 0,
      gameStatus: 'active',
    });

    expect(reaction).toBeNull();
  });
});
