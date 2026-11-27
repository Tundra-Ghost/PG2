import { describe, expect, it } from 'vitest';
import './index';
import { MODIFIER_IDS } from './ids';
import { invisibilityCloakDef, getCloakedPiece } from './definitions/invisibility-cloak';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { chessEngine } from '../engine/ChessEngine';
import { getValidPromotionTypes } from '../engine/gameLoop';
import { getHiddenPieceIds, isMoveHidden } from '../engine/visibility';
import { botView, getChickBotMove } from '../engine/bot';
import { getTells } from './definitions/tells';
import type { GameState } from '../engine/types';

function last<T>(list: T[]): T | undefined {
  return list[list.length - 1];
}

const card = { id: MODIFIER_IDS.invisibilityCloak, name: 'Invisibility Cloak', activeFor: 'both' as const, sourceColor: 'white' as const };

/** White's bishop on d4 is cloaked. */
function setup(extra = [makePiece('rook', 'black', 'a4')], blackKing: 'g8' | 'h8' = 'g8'): GameState {
  const state = makeEmptyState([
    makePiece('king', 'white', 'h1'),
    makePiece('bishop', 'white', 'd4'),
    makePiece('king', 'black', blackKing),
    ...extra,
  ]);
  state.activeModifiers = [card];
  return invisibilityCloakDef.onActivate!(state);
}

describe('Invisibility Cloak', () => {
  it('cloaks one of the owner\'s pieces, never the King, hidden only from the opponent', () => {
    const state = setup();
    expect(getCloakedPiece(state, 'white')).toBe('white-bishop-d4');
    expect(getCloakedPiece(state, 'black')).toBeNull();
    expect([...getHiddenPieceIds(state, 'black')]).toEqual(['white-bishop-d4']);
    expect(getHiddenPieceIds(state, 'white').size).toBe(0);
  });

  it('picks a knight, bishop or rook from the start position', () => {
    const s = chessEngine.getInitialState();
    s.prngState = 7;
    const state = chessEngine.activateDraftModifiers(s, [{ id: card.id, sourceColor: 'white' }]);
    const piece = [...state.pieces.values()].find(p => p.id === getCloakedPiece(state, 'white'))!;
    expect(piece.color).toBe('white');
    expect(['knight', 'bishop', 'rook']).toContain(piece.type);
  });

  it('offers enemy moves through it; such a move bumps, reveals it and keeps the turn', () => {
    const state = setup();
    state.turn = 'black';
    // The rook on a4 sees an empty rank: e4 to h4 look open.
    expect(chessEngine.getLegalMoves(state, 'a4')).toContain('f4');
    const bump = move('a4', 'f4', 'black');
    expect(chessEngine.validateMove(state, bump)).toEqual({ valid: true, bump: true });
    const next = chessEngine.applyMove(state, bump);
    expect(next.turn).toBe('black');
    expect(next.moveHistory).toHaveLength(0);
    expect(next.pieces.get('a4')?.type).toBe('rook');
    expect(getCloakedPiece(next, 'white')).toBeNull();
    expect(last(next.eventHistory)).toMatchObject({ title: 'Bump!', squares: ['d4'] });
    // Now the rook can only go up to the bishop.
    expect(chessEngine.getLegalMoves(next, 'a4')).not.toContain('f4');
  });

  it('is captured by a move that lands on it', () => {
    const state = setup();
    state.turn = 'black';
    const next = chessEngine.applyMove(state, move('a4', 'd4', 'black'));
    expect(next.pieces.get('d4')?.color).toBe('black');
    expect(last(next.moveHistory)?.pieceCaptured?.id).toBe('white-bishop-d4');
    expect(getCloakedPiece(next, 'white')).toBeNull();
  });

  it('moves unseen, and the move is hidden in the opponent\'s log', () => {
    const state = setup();
    const next = chessEngine.applyMove(state, move('d4', 'c3', 'white'));
    expect(getCloakedPiece(next, 'white')).toBe('white-bishop-d4');
    expect(isMoveHidden(next, last(next.moveHistory)!, 'black')).toBe(true);
    expect(isMoveHidden(next, last(next.moveHistory)!, 'white')).toBe(false);
  });

  it('shows when it captures', () => {
    const state = setup([makePiece('pawn', 'black', 'c5')]);
    const next = chessEngine.applyMove(state, move('d4', 'c5', 'white'));
    expect(getCloakedPiece(next, 'white')).toBeNull();
    expect(last(next.eventHistory)?.message).toContain('It captures.');
  });

  it('shows when it gives check', () => {
    const state = setup([]);
    const next = chessEngine.applyMove(state, move('d4', 'c4', 'white'));
    expect(chessEngine.isInCheck(next, 'black')).toBe(true);
    expect(getCloakedPiece(next, 'white')).toBeNull();
    expect(last(next.eventHistory)?.message).toContain('It gives check.');
  });

  it('wears off after 10 rounds', () => {
    let state = setup([makePiece('rook', 'black', 'a8')]);
    // The White King walks to new squares, so no position repeats.
    const walk = ['h1', 'h2', 'h3', 'g3', 'g2', 'f2', 'f3', 'e3', 'e2', 'd2', 'd3'] as const;
    for (let i = 0; i < 10; i++) {
      expect(getCloakedPiece(state, 'white')).toBe('white-bishop-d4');
      state = chessEngine.applyMove(state, move(walk[i], walk[i + 1], 'white'));
      state = chessEngine.applyMove(state, move(i % 2 ? 'b8' : 'a8', i % 2 ? 'a8' : 'b8', 'black'));
      expect(state.status).toBe('active');
    }
    expect(getCloakedPiece(state, 'white')).toBeNull();
    expect(last(state.eventHistory)?.message).toContain('The cloak wears off.');
  });

  it('a pin by a hidden piece is a bump, never a self-check', () => {
    // The cloaked bishop on d4 pins the black rook on f6 to the King on h8.
    const state = setup([makePiece('rook', 'black', 'f6')], 'h8');
    state.turn = 'black';
    const away = move('f6', 'f1', 'black');
    expect(chessEngine.getLegalMoves(state, 'f6')).toContain('f1');
    expect(chessEngine.validateMove(state, away).bump).toBe(true);
    const next = chessEngine.applyMove(state, away);
    expect(next.pieces.get('f6')?.type).toBe('rook');
    expect(next.turn).toBe('black');
    expect(chessEngine.getLegalMoves(next, 'f6')).not.toContain('f1');
  });

  it('reveals every hidden piece when the opponent has no move it can see (no softlock)', () => {
    const state = makeEmptyState([
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'h7'),
      makePiece('king', 'white', 'f7'),
      makePiece('pawn', 'white', 'h6'),
      makePiece('bishop', 'white', 'g6'),
    ]);
    state.activeModifiers = [card];
    let s = invisibilityCloakDef.onActivate!(state);
    expect(getCloakedPiece(s, 'white')).toBe('white-bishop-g6');
    s.turn = 'black';
    s = chessEngine.beginTurn(s);
    expect(getCloakedPiece(s, 'white')).toBeNull();
    expect(chessEngine.getLegalMoves(s, 'h7')).toContain('g6');
  });

  it('shows when it promotes', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'c7'),
      makePiece('king', 'black', 'h5'),
    ]);
    state.activeModifiers = [card];
    const s = invisibilityCloakDef.onActivate!(state);
    expect(getCloakedPiece(s, 'white')).toBe('white-pawn-c7');
    const next = chessEngine.applyMove(s, move('c7', 'c8', 'white', { promotion: 'knight' }));
    expect(getCloakedPiece(next, 'white')).toBeNull();
    expect(next.eventHistory.some(e => e.message.includes('It promotes.'))).toBe(true);
  });

  it('a move the player cannot see is refused, not tried for free', () => {
    const state = setup([makePiece('pawn', 'black', 'e5')]);
    state.turn = 'black';
    expect(chessEngine.validateMove(state, move('e5', 'd4', 'black')).valid).toBe(false);
  });

  it('a hidden piece blocking a check is revealed at turn start', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('rook', 'white', 'a1'),
      makePiece('bishop', 'white', 'a4'),
      makePiece('king', 'black', 'a8'),
      makePiece('knight', 'black', 'h8'),
    ]);
    state.activeModifiers = [card];
    let s = invisibilityCloakDef.onActivate!(state);
    expect(getCloakedPiece(s, 'white')).toBe('white-bishop-a4');
    s.turn = 'black';
    s = chessEngine.beginTurn(s);
    expect(getCloakedPiece(s, 'white')).toBeNull();
    expect(chessEngine.validateMove(s, move('h8', 'g6', 'black')).valid).toBe(true);
  });

  it('a promotion push into it keeps its dot and bumps', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h8'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'e5'),
      makePiece('pawn', 'black', 'a2'),
    ]);
    state.activeModifiers = [card];
    const s = invisibilityCloakDef.onActivate!(state);
    s.turn = 'black';
    expect(chessEngine.getLegalMoves(s, 'a2')).toContain('a1');
    expect(getValidPromotionTypes(s, 'a2', 'a1')).toContain('queen');
    expect(chessEngine.validateMove(s, move('a2', 'a1', 'black', { promotion: 'queen' })).bump).toBe(true);
  });

  it('the notation never names a hidden twin', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.activeModifiers = [card];
    state.modifierState = { [card.id]: { white: { pieceId: 'white-rook-d4', until: 99 } } };
    const next = chessEngine.applyMove(state, move('a1', 'd1', 'white'));
    expect(last(next.moveHistory)!.notation).toBe('Rd1');
  });

  it('nothing is hidden once the game is over', () => {
    const state = setup();
    state.status = 'checkmate';
    expect(getHiddenPieceIds(state, 'black').size).toBe(0);
  });

  it('bots play with the same blindness and bump into it', () => {
    const state = setup([makePiece('rook', 'black', 'a4'), makePiece('pawn', 'white', 'g4')]);
    state.turn = 'black';
    expect(botView(state, 'black').pieces.has('d4')).toBe(false);
    // The only capture it sees is the pawn on g4, through the cloaked bishop.
    const plan = getChickBotMove(state, 'black', () => 0)!;
    expect(plan).toMatchObject({ from: 'a4', to: 'g4' });
    const next = chessEngine.applyMove(state, plan);
    expect(next.turn).toBe('black');
    expect(getCloakedPiece(next, 'white')).toBeNull();
  });

  it('replays the same from the moves, bumps included', () => {
    const play = () => {
      let s = setup();
      s.turn = 'black';
      for (const m of [move('a4', 'f4', 'black'), move('a4', 'c4', 'black'), move('d4', 'c3', 'white')]) {
        expect(chessEngine.validateMove(s, m).valid).toBe(true);
        s = chessEngine.applyMove(s, m);
      }
      return s;
    };
    const a = play();
    const b = play();
    expect([...a.pieces.keys()].sort()).toEqual([...b.pieces.keys()].sort());
    expect(a.eventHistory.map(e => e.message)).toEqual(b.eventHistory.map(e => e.message));
  });

  it('Tells: a hidden piece shows no tell', () => {
    const state = setup();
    state.activeModifiers = [...state.activeModifiers, { id: MODIFIER_IDS.tells, name: 'Tells', activeFor: 'both', sourceColor: 'black' }];
    expect(getTells(state, 'black').has('d4')).toBe(false);
  });

  it('Big Beak: the eye spots a hidden piece and shows it', () => {
    const state = setup();
    state.activeModifiers = [...state.activeModifiers, { id: MODIFIER_IDS.bigBeak, name: 'Big Beak', activeFor: 'both', sourceColor: null }];
    state.modifierState = { ...state.modifierState, [MODIFIER_IDS.bigBeak]: { eye: 'd5', seen: {} } };
    const next = chessEngine.applyMove(state, move('d4', 'e5', 'white'));
    expect(getCloakedPiece(next, 'white')).toBeNull();
  });
});
