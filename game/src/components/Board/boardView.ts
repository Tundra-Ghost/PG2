import type { Color, GameState, Piece, Square, TileEffectType } from '@pigeon-chess/game-core';
import { getCrownOrders, getPigeonHops, getVisibleSquares, getInfectedReach, getNoFlySquares, getQuietZoneSquares, isFrozenZoneSquare, MODIFIER_IDS } from '@pigeon-chess/game-core';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

/** A one-off flash on a square where a modifier just struck. */
export interface SquareBurst {
  /** Changes for each new event, so the animation replays. */
  key: string;
  kind: 'lava' | 'berserker' | 'storm' | 'infection' | 'event';
}

/**
 * Everything the board needs to draw one square. The Phaser board draws from
 * this and the click squares read it, so game rules never live in a renderer.
 */
export interface SquareView {
  square: Square;
  isLight: boolean;
  piece: Piece | undefined;
  isSelected: boolean;
  isLegalTarget: boolean;
  isInCheck: boolean;
  isLastMove: boolean;
  tileEffects: TileEffectType[];
  isFrozenZone: boolean;
  isSwamp: boolean;
  /** MOD-A001: how far the slowed piece here may still move. */
  infectedReach?: number;
  /** MOD-B004: the side whose heavy King is ordered to this square. */
  crownOrder?: 'white' | 'black';
  /** MOD-E001: the side whose Pigeon will hop to this square. */
  pigeonHop?: 'white' | 'black';
  isShaft: boolean;
  /** Not part of this board's shape (puzzles). */
  isClosed: boolean;
  storm?: 'warning' | 'active';
  quietZone?: 'white' | 'black';
  noFlyZone?: 'white' | 'black';
  burst?: SquareBurst;
  /** Fog of war: the viewer cannot see this square, so enemy pieces here are not shown. */
  isHidden?: boolean;
}

export interface BoardViewInput {
  state: GameState;
  orientation: 'white' | 'black';
  selected: Square | null;
  legalMoves: Square[];
  showLegalMoves: boolean;
  checkSquare: Square | null;
  lastFrom?: Square;
  lastTo?: Square;
  bursts: Map<Square, SquareBurst>;
  /** Whose eyes the board is drawn through, for fog cards. */
  viewer?: Color;
}

/** The 64 squares in screen order: top-left first, row by row. */
export function buildSquareViews(input: BoardViewInput): SquareView[] {
  const { state, orientation, selected, legalMoves, showLegalMoves, checkSquare, lastFrom, lastTo, bursts, viewer } = input;
  const visible = viewer ? getVisibleSquares(state, viewer) : null;
  const winterActive = state.activeModifiers.some(mod => mod.id === MODIFIER_IDS.winterIsComing);
  const quietZones = getQuietZoneSquares(state);
  const noFlySquares = getNoFlySquares(state);
  const crownOrders = getCrownOrders(state);
  const pigeonHops = getPigeonHops(state);
  const rankOrder = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const fileOrder = orientation === 'white' ? [...FILES] : [...FILES].reverse();

  const views: SquareView[] = [];
  for (const rank of rankOrder) {
    for (const file of fileOrder) {
      const square = `${file}${rank}` as Square;
      const tile = state.tiles.get(square);
      const storm = tile?.storm;
      const hidden = visible !== null && !visible.has(square);
      views.push({
        square,
        isLight: (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 !== 0,
        piece: hidden ? undefined : state.pieces.get(square),
        isSelected: selected === square,
        isLegalTarget: showLegalMoves && legalMoves.includes(square),
        isInCheck: checkSquare === square,
        isLastMove: !hidden && (square === lastFrom || square === lastTo),
        tileEffects: tile?.effects.map(effect => effect.type) ?? [],
        isFrozenZone: winterActive && isFrozenZoneSquare(square),
        isSwamp: tile?.isSwamp === true,
        infectedReach: hidden ? undefined : getInfectedReach(state, square) ?? undefined,
        crownOrder: crownOrders.get(square),
        pigeonHop: pigeonHops.get(square),
        isShaft: tile?.isVoid === true && !storm && !tile.isClosed,
        isClosed: tile?.isClosed === true,
        storm,
        quietZone: quietZones.get(square),
        noFlyZone: noFlySquares.get(square),
        burst: hidden ? undefined : bursts.get(square),
        ...(hidden ? { isHidden: true } : {}),
      });
    }
  }
  return views;
}
