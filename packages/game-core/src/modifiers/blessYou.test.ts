import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { SNEEZE_EVERY, sneezeIn } from './definitions/bless-you';
import { makeEmptyState, makePiece, move } from './testHelpers';

const BLESS = MODIFIER_IDS.blessYou;

function withBless(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: BLESS, sourceColor: 'white' }, ...extra]);
}

const play = (state: GameState, from: Square, to: Square, color: 'white' | 'black') =>
  chessEngine.applyMove({ ...state, positionHistory: {} }, move(from, to, color));

/** White's rook shuffles h1-h2 (one square, never sneezes) while Black's king shuffles, `n` times. */
function sliderMoves(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) {
    const rook = state.pieces.get('h1') ? 'h1' : 'h2';
    state = play(state, rook, rook === 'h1' ? 'h2' : 'h1', 'white');
    const king = state.pieces.get('e8') ? 'e8' : 'd8';
    state = play(state, king, king === 'e8' ? 'd8' : 'e8', 'black');
  }
  return state;
}

const BASE = () => [makePiece('king', 'white', 'a1'), makePiece('rook', 'white', 'h1'), makePiece('bishop', 'white', 'c1'), makePiece('king', 'black', 'e8'), makePiece('pawn', 'black', 'a7')];

describe('MOD-B012 Bless You', () => {
  it('counts down and the 8th slider move stops one square short', () => {
    let state = withBless(BASE());
    expect(sneezeIn(state, 'white')).toBe(SNEEZE_EVERY);
    state = sliderMoves(state, SNEEZE_EVERY - 1);
    expect(sneezeIn(state, 'white')).toBe(1);
    state = play(state, 'c1', 'f4', 'white');
    expect(state.pieces.get('e3')).toMatchObject({ type: 'bishop' });
    expect(state.pieces.get('f4')).toBeUndefined();
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: BLESS, title: 'ACHOO' });
    expect(sneezeIn(state, 'white')).toBe(SNEEZE_EVERY);
  });

  it('a sneezing capture stops short and captures nothing', () => {
    let state = withBless([...BASE(), makePiece('knight', 'black', 'g5')]);
    state = sliderMoves(state, SNEEZE_EVERY - 1);
    state = play(state, 'c1', 'g5', 'white');
    expect(state.pieces.get('g5')).toMatchObject({ type: 'knight', color: 'black' });
    expect(state.pieces.get('f4')).toMatchObject({ type: 'bishop' });
  });

  it('a one-square slide cannot sneeze, and the sneeze is spent', () => {
    let state = withBless(BASE());
    state = sliderMoves(state, SNEEZE_EVERY);
    expect(state.pieces.get('h1') ?? state.pieces.get('h2')).toMatchObject({ type: 'rook' });
    expect(sneezeIn(state, 'white')).toBe(SNEEZE_EVERY);
  });

  it('if stopping short would leave the King in check, the move happens in full', () => {
    // The black rook on e8 checks the King on e1. Bb2-e5 blocks; stopping on d4 would not.
    let state = withBless([makePiece('king', 'white', 'e1'), makePiece('bishop', 'white', 'b2'), makePiece('rook', 'black', 'e8'), makePiece('king', 'black', 'a8'), makePiece('pawn', 'black', 'a7')]);
    state = { ...state, modifierState: { ...state.modifierState, [BLESS]: { count: { white: SNEEZE_EVERY - 1 } } } };
    expect(sneezeIn(state, 'white')).toBe(1);
    expect(chessEngine.validateMove(state, move('b2', 'e5', 'white')).valid).toBe(true);
    state = play(state, 'b2', 'e5', 'white');
    expect(state.pieces.get('e5')).toMatchObject({ type: 'bishop' });
    expect(sneezeIn(state, 'white')).toBe(SNEEZE_EVERY);
  });

  it('only its owner sneezes', () => {
    const state = withBless(BASE());
    expect(sneezeIn(state, 'black')).toBeNull();
  });

  it('with Imposter Syndrome, a doubting Queen moves one square and cannot sneeze (interaction)', () => {
    let state = withBless([...BASE(), makePiece('queen', 'white', 'd1'), makePiece('pawn', 'black', 'd5')], [{ id: MODIFIER_IDS.imposterSyndrome, sourceColor: 'white' }]);
    state = sliderMoves(state, SNEEZE_EVERY - 2);
    state = play(state, 'd1', 'd5', 'white'); // 7th slider move: a capture, so she doubts
    const king = state.pieces.get('e8') ? 'e8' : 'd8';
    state = play(state, king, king === 'e8' ? 'f8' : 'c8', 'black');
    expect(sneezeIn(state, 'white')).toBe(1);
    state = play(state, 'd5', 'd6', 'white');
    expect(state.pieces.get('d6')).toMatchObject({ type: 'queen' });
  });
});
