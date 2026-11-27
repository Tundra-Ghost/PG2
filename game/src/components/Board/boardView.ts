import type { Color, GameState, Piece, PieceType, Square, TileEffectType } from '@pigeon-chess/game-core';
import { getBlindSpot, getConfession, getLavaPreview, getTaxDayPawn, sneezeIn, isBandersnatchActive, getCrownOrders, getShownType, getSusPiece, getSmokeSquares, getSurveillanceSquare, getPigeonHops, getVisibleSquares, getFootprints, getFlashlightSquares, getForecast, getHiddenPieceIds, getOwnCups, isCup, getTells, getInfectedReach, getNoFlySquares, getQuietZoneSquares, isFrozenZoneSquare, getFlowArrows, getRoomba, getQuakeArrows, getMineClues, isLightsOut, getSpoilerMarks, MODIFIER_IDS, type Flow } from '@pigeon-chess/game-core';

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
  /** MOD-E001 is in play for this Pigeon's side, so it hops on its own every few rounds. */
  pigeonsHop?: boolean;
  isShaft: boolean;
  /** MOD-A016: Gerald's statue stands here. */
  statue?: boolean;
  /** Not part of this board's shape (puzzles). */
  isClosed: boolean;
  storm?: 'warning' | 'active';
  quietZone?: 'white' | 'black';
  noFlyZone?: 'white' | 'black';
  burst?: SquareBurst;
  /** Fog of war: the viewer cannot see this square, so enemy pieces here are not shown. */
  isHidden?: boolean;
  /** Known Unknowns: this square is in the viewer's own Blind Spot. */
  blindSpot?: boolean;
  /** Big Beak Is Watching: the Surveillance Square. */
  surveillance?: boolean;
  /** What's In The Cloud, Bro: smoke here, made by this side. */
  smoke?: 'white' | 'black';
  /** Sus: the viewer's own disguised piece, and what the opponent sees. */
  susAs?: PieceType;
  /** Shell Game: 'enemy' when the viewer sees this piece as a cup, 'own' on the viewer's own cups. */
  cup?: 'enemy' | 'own';
  /** Invisibility Cloak, Camouflage: the viewer's own piece that the opponent cannot see. */
  unseen?: boolean;
  /** I'm Literally Right Here: the viewer's own Ghost, drawn faded. */
  ghost?: boolean;
  /** Forgive Me: 'piece' on the confessing piece, 'target' on its declared square. */
  confession?: 'piece' | 'target';
  /** The Floor Is Lava: lava moves here at the next rotation. */
  lavaNext?: boolean;
  /** Footprints: an enemy piece left this square into the fog. */
  footprint?: boolean;
  /** Flashlight: the viewer is lighting this square. */
  lit?: boolean;
  /** Crystal Ball: a timed event lands here within 2 rounds. */
  forecast?: { title: string; rounds: number };
  /** Tells: this enemy piece's ability is ready (0) or this many turns away. */
  tell?: number;
  /** Death And Taxes: the tax office takes this pawn after this move. */
  taxed?: boolean;
  /** The Birds: a flock sits here, or lands here next round. */
  flock?: 'warning' | 'active';
  /** Thinking With Portals: a portal sits here. */
  portal?: 'blue' | 'orange';
  /** Tide Goes In: water here now, or next round. */
  tide?: 'warning' | 'active';
  /** Bless You: this slider's side sneezes after this many more rook, bishop or queen moves (1 = the next one). */
  sneezeIn?: number;
  /** Crop Circles: a circle here now, or next round. */
  cropCircle?: 'warning' | 'active';
  /** Shake It Off: the next quake moves this piece this way, on screen (dx right, dy down). */
  quake?: { dx: number; dy: number };
  /** Minesweeper: how many mines touch this square. */
  mineClue?: number;
  /** Let It Go: ice. */
  ice?: boolean;
  /** Dirt Hut: a wall built by this side stands here. */
  wall?: 'white' | 'black';
  /** Conveyor belts and other one-way squares: the way pieces go here, on screen. */
  flow?: ScreenFlow[];
  /** The Roomba is here, heading this way on screen. */
  roomba?: ScreenFlow;
  /** Spoiler Alert: this side marked this piece to move next. */
  spoiler?: 'white' | 'black';
  /** Bandersnatch Protocol: the mirror axis runs along this edge of a d-file square. */
  mirrorEdge?: 'left' | 'right';
}

export type ScreenFlow = 'up' | 'down' | 'left' | 'right';

const SCREEN_FLOW: Record<'white' | 'black', Record<Flow, ScreenFlow>> = {
  white: { north: 'up', south: 'down', east: 'right', west: 'left' },
  black: { north: 'down', south: 'up', east: 'left', west: 'right' },
};

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
/** MOD-E009: a Sus piece shown as a queen wears the Amazon badge (♞) when its side has an Amazon, so the badge never gives the disguise away. */
function hasAmazon(state: GameState, color: Color): boolean {
  for (const piece of state.pieces.values()) {
    if (piece.color === color && piece.type === 'queen' && piece.isAmazon) return true;
  }
  return false;
}

export function buildSquareViews(input: BoardViewInput): SquareView[] {
  const { state, orientation, selected, legalMoves, showLegalMoves, checkSquare, lastFrom, lastTo, bursts, viewer } = input;
  const visible = viewer ? getVisibleSquares(state, viewer) : null;
  const flows = getFlowArrows(state);
  const toScreen = (flow: Flow): ScreenFlow => SCREEN_FLOW[orientation][flow];
  const roomba = getRoomba(state);
  const mineClues = new Map(getMineClues(state, viewer ?? null).map(c => [c.square, c.count]));
  const sign = orientation === 'white' ? 1 : -1;
  const quakes = new Map(getQuakeArrows(state, viewer ?? null).map(a => [a.square, { dx: a.df * sign, dy: -a.dr * sign }]));
  const winterActive = state.activeModifiers.some(mod => mod.id === MODIFIER_IDS.winterIsComing);
  const quietZones = getQuietZoneSquares(state);
  const noFlySquares = getNoFlySquares(state);
  const crownOrders = getCrownOrders(state);
  const pigeonHops = getPigeonHops(state, viewer ?? undefined);
  // Hatoful Gambit only moves the Pigeons of the side it belongs to (or both, if shared).
  const pigeonsHopFor = (color: Color) =>
    state.activeModifiers.some(
      mod => mod.id === MODIFIER_IDS.hatofulGambit && (mod.sourceColor == null || mod.sourceColor === color),
    );
  const blindSpot = new Set(viewer ? getBlindSpot(state, viewer) : []);
  const eye = getSurveillanceSquare(state);
  const smoke = getSmokeSquares(state);
  const lavaNext = new Set(getLavaPreview(state));
  const footprints = new Set(viewer ? getFootprints(state, viewer) : []);
  const lit = new Set(viewer ? getFlashlightSquares(state, viewer) : []);
  const forecast = viewer ? getForecast(state, viewer) : new Map();
  const tells = viewer ? getTells(state, viewer) : new Map<Square, number>();
  const taxed = getTaxDayPawn(state);
  const sneezes = { white: sneezeIn(state, 'white'), black: sneezeIn(state, 'black') };
  const ownSus = viewer ? getSusPiece(state, viewer) : null;
  // Hidden pieces: enemy pieces the viewer cannot see, and the viewer's own the opponent cannot.
  const hiddenEnemies = viewer ? getHiddenPieceIds(state, viewer) : new Set<string>();
  const rawConfession = getConfession(state);
  // A confessing piece the viewer cannot see shows no confession.
  const confession = rawConfession && viewer && [...state.pieces.values()].some(p => p.square === rawConfession.square && hiddenEnemies.has(p.id)) ? null : rawConfession;
  const ownCups = new Set(viewer ? getOwnCups(state, viewer) : []);
  const ownUnseen = viewer ? getHiddenPieceIds(state, viewer === 'white' ? 'black' : 'white') : new Set<string>();
  // Jump Scare: in the dark round the viewer's own pieces are hidden too, all but the King (tapping still works).
  const lightsOut = viewer ? isLightsOut(state) : false;
  const spoilers = new Map(getSpoilerMarks(state, viewer ?? null).map(mark => [mark.square, mark.color]));
  const mirrorEdge = isBandersnatchActive(state) ? (orientation === 'white' ? 'right' : 'left') : null;
  const rankOrder = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const fileOrder = orientation === 'white' ? [...FILES] : [...FILES].reverse();

  const views: SquareView[] = [];
  for (const rank of rankOrder) {
    for (const file of fileOrder) {
      const square = `${file}${rank}` as Square;
      const tile = state.tiles.get(square);
      const storm = tile?.storm;
      const hidden = visible !== null && !visible.has(square);
      const onSquare = state.pieces.get(square);
      const ownInDark = lightsOut && !!onSquare && onSquare.color === viewer && onSquare.type !== 'king' && !onSquare.isRealKing;
      const real = hidden || ownInDark || (onSquare && hiddenEnemies.has(onSquare.id)) ? undefined : onSquare;
      // Sus: the opponent's disguised piece is drawn as its fake type.
      const shownType = real && viewer ? getShownType(state, real, viewer) : real?.type;
      const piece = real && shownType !== real.type
        ? { ...real, type: shownType!, isAmazon: shownType === 'queen' && hasAmazon(state, real.color), isDoubting: false }
        : real;
      views.push({
        square,
        isLight: (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 !== 0,
        piece,
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
        ...(piece?.type === 'pigeon' && pigeonsHopFor(piece.color) ? { pigeonsHop: true } : {}),
        isShaft: tile?.isVoid === true && !storm && !tile.isClosed && !tile.statue && !tile.barrier,
        ...(tile?.barrier?.kind === 'wall' && tile.barrier.owner ? { wall: tile.barrier.owner } : {}),
        ...(tile?.barrier?.kind === 'flock' ? { flock: 'active' as const } : tile?.flockWarning ? { flock: 'warning' as const } : {}),
        ...(tile?.statue ? { statue: true } : {}),
        ...(tile?.portal ? { portal: tile.portal } : {}),
        ...(tile?.tide ? { tide: tile.tide } : {}),
        ...(tile?.cropCircle ? { cropCircle: tile.cropCircle } : {}),
        ...(tile?.ice ? { ice: true } : {}),
        ...(mineClues.has(square) ? { mineClue: mineClues.get(square)! } : {}),
        ...(quakes.has(square) ? { quake: quakes.get(square)! } : {}),
        ...(roomba?.square === square ? { roomba: toScreen(roomba.heading) } : {}),
        ...(flows.has(square) ? { flow: flows.get(square)!.map(toScreen) } : {}),
        // Bless You: badges go on the pieces as the viewer sees them (Sus). The count itself follows real
        // moves, which Sus already says can show a disguise through how the piece moves.
        ...(piece && ['rook', 'bishop', 'queen'].includes(piece.type) && sneezes[piece.color] != null ? { sneezeIn: sneezes[piece.color]! } : {}),
        isClosed: tile?.isClosed === true,
        storm,
        quietZone: quietZones.get(square),
        noFlyZone: noFlySquares.get(square),
        burst: hidden ? undefined : bursts.get(square),
        ...(hidden ? { isHidden: true } : {}),
        ...(blindSpot.has(square) ? { blindSpot: true } : {}),
        ...(eye === square ? { surveillance: true } : {}),
        ...(smoke.has(square) ? { smoke: smoke.get(square) } : {}),
        ...(lavaNext.has(square) ? { lavaNext: true } : {}),
        ...(footprints.has(square) ? { footprint: true } : {}),
        ...(lit.has(square) ? { lit: true } : {}),
        ...(forecast.has(square) ? { forecast: forecast.get(square) } : {}),
        ...(tells.has(square) ? { tell: tells.get(square) } : {}),
        ...(!hidden && taxed === square ? { taxed: true } : {}),
        ...(ownSus && real?.id === ownSus.pieceId ? { susAs: ownSus.shownAs } : {}),
        ...(real && ownUnseen.has(real.id) ? { unseen: true } : {}),
        ...(real && viewer && isCup(state, real, viewer) ? { cup: 'enemy' as const } : real && ownCups.has(square) ? { cup: 'own' as const } : {}),
        ...(mirrorEdge && file === 'd' ? { mirrorEdge } : {}),
        ...(spoilers.has(square) ? { spoiler: spoilers.get(square)! } : {}),
        ...(confession?.square === square ? { confession: 'piece' as const } : confession?.declared === square ? { confession: 'target' as const } : {}),
        // The opponent sees a Ghost as a normal piece.
        ...(real?.isGhost && (!viewer || real.color === viewer) ? { ghost: true } : {}),
      });
    }
  }
  return views;
}
