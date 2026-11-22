import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { cutsOffAKing, getBarriers } from '../engine/barriers';
import type { GameState, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getFlockPreview, theBirdsDef } from './definitions/the-birds';
import { makeEmptyState, makePiece, move } from './testHelpers';

const BIRDS = MODIFIER_IDS.theBirds;

/** Pawns on b2 and g7 keep the game from a bare-Kings draw. */
const BASE = () => [makePiece('king', 'white', 'a1'), makePiece('pawn', 'white', 'b2'), makePiece('pawn', 'black', 'g7'), makePiece('king', 'black', 'h8')];

function withBirds(pieces = BASE()): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [
    { id: BIRDS, sourceColor: null },
    { id: MODIFIER_IDS.dirtHut, sourceColor: 'white' },
  ]);
}

/** Kings shuffle between their corners until turnNumber reaches `target`. */
function playTo(state: GameState, target: number): GameState {
  const steps: Record<string, Square> = { a1: 'a2', a2: 'a1', h8: 'h7', h7: 'h8' };
  while (state.turnNumber < target) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn)!;
    // The shuffle repeats; forget the repetitions so it is never a draw.
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const rankOk = (sq: Square) => Number(sq[1]) >= 3 && Number(sq[1]) <= 6;

describe('MOD-A009 The Birds', () => {
  it('shows the spot one round ahead, lands on round 7, and flies off 2 rounds later', () => {
    let state = playTo(withBirds(), 10);
    expect(getFlockPreview(state)).toEqual([]);
    state = playTo(state, 11);
    const preview = getFlockPreview(state);
    expect(preview).toHaveLength(4);
    expect(preview.every(rankOk)).toBe(true);
    expect(preview.every(sq => state.tiles.get(sq)?.flockWarning)).toBe(true);

    state = playTo(state, 13);
    const flock = getBarriers(state, 'flock').map(b => b.square).sort();
    expect(flock).toEqual([...preview].sort());
    expect(getFlockPreview(state)).toEqual([]);
    expect(preview.every(sq => !state.tiles.get(sq)?.flockWarning)).toBe(true);

    state = playTo(state, 16);
    expect(getBarriers(state, 'flock')).toHaveLength(4);
    state = playTo(state, 17);
    expect(getBarriers(state, 'flock')).toHaveLength(0);
    expect(preview.every(sq => state.tiles.get(sq) === undefined)).toBe(true);
  });

  it('is replayed exactly from the same seed', () => {
    const a = playTo(withBirds(), 13);
    const b = playTo(withBirds(), 13);
    expect(getBarriers(a, 'flock')).toEqual(getBarriers(b, 'flock'));
    expect(a.prngState).toEqual(b.prngState);
  });

  it('blocks sliding and landing while it sits', () => {
    let state = playTo(withBirds(), 13);
    const flock = getBarriers(state, 'flock').map(b => b.square);
    state = { ...state, pieces: new Map(state.pieces) };
    // Put a rook on the flock's rank and check it stops before the flock.
    const rank = flock[0][1];
    const rookSq = (flock.some(sq => sq[0] === 'a') ? `h${rank}` : `a${rank}`) as Square;
    state.pieces.set(rookSq, makePiece('rook', 'white', rookSq));
    const targets = chessEngine.getLegalMoves(state, rookSq);
    for (const sq of flock) expect(targets).not.toContain(sq);
  });

  it('never lands on a piece: a piece in the marked spot sends the flock elsewhere', () => {
    let state = playTo(withBirds(), 11);
    const preview = getFlockPreview(state);
    state = { ...state, pieces: new Map(state.pieces) };
    state.pieces.set(preview[0], makePiece('knight', 'white', preview[0]));
    state = playTo(state, 13);
    const flock = getBarriers(state, 'flock').map(b => b.square);
    expect(flock).toHaveLength(4);
    expect(flock).not.toContain(preview[0]);
    expect(state.pieces.get(preview[0])).toMatchObject({ type: 'knight' });
  });

  it('never takes the last legal move of a King', () => {
    // Black King on a6: rooks on b1 and h7 leave it only a5.
    const pieces = [
      makePiece('king', 'white', 'h1'),
      makePiece('rook', 'white', 'b1'),
      makePiece('rook', 'white', 'h7'),
      makePiece('king', 'black', 'a6'),
    ];
    expect(cutsOffAKing(withBirds(pieces), ['a5'])).toBe(true);
    for (let seed = 1; seed <= 30; seed++) {
      const state = withBirds(pieces);
      state.prngState = seed;
      state.turnNumber = 13;
      const landed = theBirdsDef.onTurnStart!(state);
      const flock = getBarriers(landed, 'flock').map(b => b.square);
      expect(flock).toHaveLength(4);
      // Black still has a King move after the flock lands.
      const asBlack = { ...landed, turn: 'black' as const };
      expect(chessEngine.getLegalMoves(asBlack, 'a6').length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('does not land twice when the turn start runs again', () => {
    const state = playTo(withBirds(), 13);
    const again = theBirdsDef.onTurnStart!(state);
    expect(getBarriers(again, 'flock')).toHaveLength(4);
    expect(again.prngState).toBe(state.prngState);
  });

  it('a Dirt Hut wall and the flock share the board (interaction)', () => {
    let state = withBirds([...BASE(), makePiece('rook', 'white', 'h1')]);
    state = chessEngine.applyMove(state, move('h1', 'h2', 'white', { ability: MODIFIER_IDS.dirtHut }));
    expect(state.tiles.get('h2')?.barrier?.kind).toBe('wall');
    expect(getBarriers(state, 'flock')).toHaveLength(0);
  });
});
