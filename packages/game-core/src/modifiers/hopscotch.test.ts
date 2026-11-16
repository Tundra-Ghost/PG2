import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove, getPigeonBotMove } from '../engine/bot';
import { isInCheck } from '../engine/moveGenerator';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const HOP = MODIFIER_IDS.hopscotch;

describe('MOD-E012 Hopscotch (The Grasshopper)', () => {
  it('turns one seeded rook into a Grasshopper and drops castling on that side', () => {
    const pick = (seed: number) => {
      const start = chessEngine.getInitialState();
      start.prngSeed = seed;
      start.prngState = seed;
      return chessEngine.activateDraftModifiers(start, [{ id: HOP, sourceColor: 'white' }]);
    };
    const state = pick(5);
    const hoppers = Array.from(state.pieces.values()).filter(p => p.type === 'grasshopper');
    expect(hoppers).toHaveLength(1);
    expect(hoppers[0].color).toBe('white');
    const rights = state.flags.castlingRights.white;
    expect(hoppers[0].square === 'h1' ? rights.kingSide : rights.queenSide).toBe(false);
    const square = (seed: number) => Array.from(pick(seed).pieces.values()).find(p => p.type === 'grasshopper')!.square;
    expect(new Set(Array.from({ length: 20 }, (_, i) => square(i + 1)))).toEqual(new Set(['a1', 'h1']));
  });

  it('hops the first piece on each queen line and lands right behind it', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('grasshopper', 'white', 'd4'),
      makePiece('pawn', 'white', 'd6'), // land d7
      makePiece('pawn', 'black', 'f6'), // land g7
      makePiece('knight', 'black', 'b4'), // land a4
      makePiece('rook', 'black', 'a4'), // ... which holds an enemy: capture
      makePiece('pawn', 'white', 'd2'), // land d1
      makePiece('bishop', 'white', 'g4'), // land h4
      makePiece('pawn', 'white', 'h4'), // own piece there: no move
      makePiece('king', 'black', 'a8'),
    ]);
    const moves = [...chessEngine.getLegalMoves(state, 'd4')].sort();
    expect(moves).toEqual(['a4', 'd1', 'd7', 'g7']);
    const next = chessEngine.applyMove(state, move('d4', 'a4', 'white'));
    expect(next.pieces.get('a4')?.type).toBe('grasshopper');
    expect(next.pieces.get('b4')?.type).toBe('knight');
    expect(next.moveHistory[0].notation).toBe('Ghxa4');
  });

  it('cannot move with nothing to hop, and never hops over a void square', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('grasshopper', 'white', 'a1'),
      makePiece('pawn', 'black', 'a5'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'a1')).toEqual(['a6']);
    state.tiles.set('a3', { square: 'a3', effects: [], statue: true, isVoid: true });
    expect(chessEngine.getLegalMoves(state, 'a1')).toEqual([]);
  });

  it('gives check by hopping, and only then', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('grasshopper', 'white', 'e2'),
      makePiece('king', 'black', 'e8'),
    ]);
    expect(isInCheck(state, 'black')).toBe(false); // nothing to hop
    state.pieces.set('e6', makePiece('pawn', 'black', 'e6'));
    expect(isInCheck(state, 'black')).toBe(false); // lands on e7, not e8
    state.pieces.delete('e6');
    state.pieces.set('e7', makePiece('pawn', 'black', 'e7'));
    expect(isInCheck(state, 'black')).toBe(true); // hops e7 onto the King
  });

  it('a hop may not leave its own King in check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a4'),
      makePiece('grasshopper', 'white', 'd4'),
      makePiece('rook', 'black', 'h4'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.validateMove(state, move('d4', 'd6', 'white')).valid).toBe(false);
  });

  it('goes to lunch with Lunch Break, like the rook it replaced', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('grasshopper', 'white', 'a1'),
        makePiece('pawn', 'white', 'a2'),
        makePiece('knight', 'white', 'b1'),
        makePiece('king', 'black', 'e8'),
      ]),
      [{ id: MODIFIER_IDS.lunchBreak, sourceColor: 'white' }],
    );
    state.turnNumber = 2 * 11 - 1;
    expect(chessEngine.validateMove(state, move('a1', 'a3', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white')).valid).toBe(true);
    state.turnNumber = 2 * 10 - 1;
    expect(chessEngine.validateMove(state, move('a1', 'a3', 'white')).valid).toBe(true);
  });

  it('This Is My Swamp: stuck for 2 moves like a leaper, then hops out', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'h1'),
        makePiece('grasshopper', 'white', 'd1'),
        makePiece('pawn', 'white', 'd3'),
        makePiece('pawn', 'white', 'd5'),
        makePiece('knight', 'white', 'b1'),
        makePiece('king', 'black', 'a8'),
      ]),
      [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: 'white' }],
    );
    state = chessEngine.applyMove(state, move('d1', 'd4', 'white'));
    for (let i = 0; i < 2; i++) {
      state = chessEngine.applyMove(state, move(i === 0 ? 'a8' : 'b8', i === 0 ? 'b8' : 'a8', 'black'));
      expect(chessEngine.validateMove(state, move('d4', 'd6', 'white')).valid).toBe(false);
      state = chessEngine.applyMove(state, move(i === 0 ? 'b1' : 'c3', i === 0 ? 'c3' : 'b1', 'white'));
    }
    state = chessEngine.applyMove(state, move('a8', 'b8', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'd6', 'white')).valid).toBe(true);
  });

  it('castling: refused through a square it hops onto, and when the castled King would be hopped', () => {
    const guarded = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('grasshopper', 'black', 'f3'),
      makePiece('pawn', 'black', 'f2'),
      makePiece('king', 'black', 'a8'),
    ]);
    guarded.flags.castlingRights.white = { kingSide: true, queenSide: false };
    expect(chessEngine.validateMove(guarded, move('e1', 'g1', 'white', { isCastle: 'kingside' })).valid).toBe(false);
    // On the back rank, after O-O the rook on f1 is a hurdle onto the King on g1.
    const rank = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('grasshopper', 'black', 'c1'),
      makePiece('king', 'black', 'a8'),
    ]);
    rank.flags.castlingRights.white = { kingSide: true, queenSide: false };
    expect(chessEngine.getLegalMoves(rank, 'e1')).not.toContain('g1');
    // With the Grasshopper off the back rank, castling is fine.
    rank.pieces.delete('c1');
    rank.pieces.set('c3', makePiece('grasshopper', 'black', 'c3'));
    expect(chessEngine.getLegalMoves(rank, 'e1')).toContain('g1');
  });

  it('bots play legal Grasshopper moves and take a free piece', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('grasshopper', 'white', 'd1'),
      makePiece('pawn', 'black', 'd6'),
      makePiece('queen', 'black', 'd7'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(getPigeonBotMove(state, 'white', { depth: 2 })).toMatchObject({ from: 'd1', to: 'd7' });
    expect(chessEngine.validateMove(state, getChickBotMove(state, 'white', () => 0)!).valid).toBe(true);
  });

  it('cannot be drafted with The Chancellor or Overseas Hire on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === HOP)!;
    for (const other of [MODIFIER_IDS.chancellor, MODIFIER_IDS.overseasHire]) {
      expect(pickBlocker(card, [other], [], built)).toMatch(/Does not work with/);
      expect(getValidOptions([other], [], built).map(c => c.id)).not.toContain(HOP);
      expect(getValidOptions([], [other], built).map(c => c.id)).toContain(HOP);
    }
  });
});
