import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove, getPigeonBotMove } from '../engine/bot';
import { isInCheck, isSquareAttacked } from '../engine/moveGenerator';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const CANNON = MODIFIER_IDS.overseasHire;

describe('MOD-E013 Overseas Hire (The Cannon)', () => {
  it('turns one random owner rook into a Cannon and drops castling on that side', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: CANNON, sourceColor: 'white' },
    ]);
    const cannons = Array.from(state.pieces.values()).filter(p => p.type === 'cannon');
    expect(cannons).toHaveLength(1);
    expect(cannons[0].color).toBe('white');
    expect(['a1', 'h1']).toContain(cannons[0].square);
    const rights = state.flags.castlingRights.white;
    expect(cannons[0].square === 'h1' ? rights.kingSide : rights.queenSide).toBe(false);
    expect(cannons[0].square === 'h1' ? rights.queenSide : rights.kingSide).toBe(true);
    expect(state.flags.castlingRights.black).toEqual({ kingSide: true, queenSide: true });
  });

  it('picks the rook with the seed: same seed, same rook, and seeds reach both corners', () => {
    const pick = (seed: number) => {
      const start = chessEngine.getInitialState();
      start.prngSeed = seed;
      start.prngState = seed;
      const state = chessEngine.activateDraftModifiers(start, [{ id: CANNON, sourceColor: 'black' }]);
      return Array.from(state.pieces.values()).find(p => p.type === 'cannon')!.square;
    };
    expect(pick(11)).toBe(pick(11));
    const corners = new Set(Array.from({ length: 20 }, (_, i) => pick(i + 1)));
    expect(corners).toEqual(new Set(['a8', 'h8']));
  });

  it('slides like a rook but never captures the first piece it meets', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('cannon', 'white', 'd4'),
      makePiece('knight', 'black', 'd6'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'd4');
    expect(moves).toEqual(expect.arrayContaining(['d5', 'd3', 'd1', 'a4', 'h4']));
    expect(moves).not.toContain('d6');
    expect(moves).not.toContain('e5');
  });

  it('captures by hopping exactly one screen of either colour', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('cannon', 'white', 'd4'),
      makePiece('pawn', 'white', 'd5'),
      makePiece('knight', 'black', 'd7'),
      makePiece('pawn', 'black', 'b4'),
      makePiece('rook', 'black', 'a4'),
      makePiece('bishop', 'white', 'f4'),
      makePiece('pawn', 'white', 'g4'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'd4');
    expect(moves).toContain('d7'); // over own pawn
    expect(moves).toContain('a4'); // over enemy pawn
    expect(moves).not.toContain('d6'); // empty square past the screen is not a move
    expect(moves).not.toContain('g4'); // own piece behind the screen
    expect(moves).not.toContain('b4');
    const next = chessEngine.applyMove(state, move('d4', 'd7', 'white'));
    expect(next.pieces.get('d7')?.type).toBe('cannon');
    expect(next.pieces.get('d5')?.type).toBe('pawn');
    expect(next.moveHistory[0].notation).toBe('Cnxd7');
  });

  it('never hops two screens', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('cannon', 'white', 'a1'),
      makePiece('pawn', 'white', 'a2'),
      makePiece('pawn', 'black', 'a3'),
      makePiece('rook', 'black', 'a5'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'a1');
    expect(moves).toContain('a3');
    expect(moves).not.toContain('a5');
  });

  it('gives check only through a screen', () => {
    const open = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('cannon', 'white', 'e2'),
      makePiece('king', 'black', 'e8'),
    ]);
    expect(isInCheck(open, 'black')).toBe(false);
    open.pieces.set('e5', makePiece('pawn', 'black', 'e5'));
    expect(isInCheck(open, 'black')).toBe(true);
  });

  it('threatens the squares past a screen, not the ones it can only slide to', () => {
    const state = makeEmptyState([
      makePiece('king', 'black', 'a8'),
      makePiece('cannon', 'black', 'e8'),
      makePiece('pawn', 'black', 'e5'),
      makePiece('king', 'white', 'h1'),
    ]);
    expect(isSquareAttacked(state, 'e6', 'black')).toBe(false);
    expect(isSquareAttacked(state, 'e3', 'black')).toBe(true);
    expect(isSquareAttacked(state, 'e1', 'black')).toBe(true);
  });

  it('a King may not step behind a screen, and putting a screen in front of your own King is illegal', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'd1'),
      makePiece('rook', 'white', 'a4'),
      makePiece('cannon', 'black', 'e8'),
      makePiece('pawn', 'black', 'e5'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(chessEngine.validateMove(state, move('d1', 'e1', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d1', 'c1', 'white')).valid).toBe(true);
    // A white piece between the Cannon and an e-file King would be a screen.
    const second = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'a4'),
      makePiece('cannon', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(chessEngine.validateMove(second, move('a4', 'e4', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(second, move('a4', 'b4', 'white')).valid).toBe(true);
  });

  it('a Cannon capture may not leave its own King in check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a4'),
      makePiece('cannon', 'white', 'd4'),
      makePiece('rook', 'black', 'h4'),
      makePiece('pawn', 'black', 'd6'),
      makePiece('knight', 'black', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.validateMove(state, move('d4', 'd8', 'white')).valid).toBe(false);
  });

  it('cannot castle with a Cannon, and castling avoids squares a Cannon threatens', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'h1'),
      makePiece('cannon', 'black', 'f8'),
      makePiece('pawn', 'black', 'f5'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.flags.castlingRights.white.kingSide = true;
    expect(chessEngine.validateMove(state, move('e1', 'g1', 'white', { isCastle: 'kingside' })).valid).toBe(false);
    // With no screen, the f-file is only a slide, not a threat.
    state.pieces.delete('f5');
    expect(chessEngine.validateMove(state, move('e1', 'g1', 'white', { isCastle: 'kingside' })).valid).toBe(true);
  });

  it('never hops over a void square (the Statue is not a screen)', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('cannon', 'white', 'a1'),
      makePiece('knight', 'black', 'a6'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.tiles.set('a3', { square: 'a3', effects: [], statue: true, isVoid: true });
    const moves = chessEngine.getLegalMoves(state, 'a1');
    expect([...moves].sort()).toEqual(['a2', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1']);
    expect(moves).not.toContain('a6');
    expect(moves).not.toContain('a4');
  });

  it('bots play legal Cannon moves and take a free piece over a screen', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'h1'),
        makePiece('rook', 'white', 'd1'),
        makePiece('pawn', 'white', 'd3'),
        makePiece('queen', 'black', 'd7'),
        makePiece('king', 'black', 'a8'),
      ]),
      [{ id: CANNON, sourceColor: 'white' }],
    );
    expect(state.pieces.get('d1')?.type).toBe('cannon');
    const pigeon = getPigeonBotMove(state, 'white', { depth: 2 })!;
    expect(pigeon).toMatchObject({ from: 'd1', to: 'd7' });
    expect(chessEngine.validateMove(state, getChickBotMove(state, 'white', () => 0)!).valid).toBe(true);
  });

  it('cannot be drafted with The Chancellor on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === CANNON)!;
    expect(pickBlocker(card, [MODIFIER_IDS.chancellor], [], built)).toMatch(/Does not work with/);
    expect(getValidOptions([MODIFIER_IDS.chancellor], [], built).map(c => c.id)).not.toContain(CANNON);
    expect(getValidOptions([], [MODIFIER_IDS.chancellor], built).map(c => c.id)).toContain(CANNON);
  });
});
