import type { Color, GameState, Piece } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';

const GERALD_ID = MODIFIER_IDS.gerald;

export function shouldForfeitTurnForGerald(
  piece: Piece | undefined,
  turn: Color,
): boolean {
  if (!piece) return false;
  if (piece.color !== turn) return false;
  return (piece.cooldowns[GERALD_ID] ?? 0) > 0;
}

export interface MarkerLegendEntry {
  mark: string;
  label: string;
}

/** What is on the board right now, for legend rows that only matter while a piece exists. */
export interface MarkerLegendContext {
  /** An Egg (MOD-E016) is still waiting to hatch. */
  eggOnBoard?: boolean;
  /** No, I Don't Think I Will (MOD-B003): flipped moves the viewer has left. */
  flippedMovesLeft?: number;
  /** A touch screen, so the legend says "tap" instead of "click". */
  touchScreen?: boolean;
  /** Cards that apply to the viewer's side. Owner-only rows need the card here. */
  viewerModifierIds?: readonly string[];
}

type LegendRow = {
  modifierId: string;
  /** Only the side that owns the card sees this marker, so only that side gets the row. */
  ownerOnly?: boolean;
  showIf?: (ctx: MarkerLegendContext) => boolean;
  /** A label that depends on the match, in place of `label`. */
  labelFor?: (ctx: MarkerLegendContext) => string;
} & MarkerLegendEntry;

/** Piece and tile markers, in the order they appear in the legend. */
const MARKER_LEGEND: LegendRow[] = [
  { modifierId: MODIFIER_IDS.floorIsLava, mark: '▲', label: 'Lava' },
  { modifierId: MODIFIER_IDS.floorIsLava, mark: '△', label: 'Lava next' },
  { modifierId: MODIFIER_IDS.cordycepticSpread, mark: '✱', label: 'Infected' },
  { modifierId: MODIFIER_IDS.winterIsComing, mark: '❄', label: 'Frozen' },
  { modifierId: MODIFIER_IDS.thisIsMySwamp, mark: '≈', label: 'Swamp' },
  { modifierId: MODIFIER_IDS.gerald, mark: 'G', label: 'Gerald' },
  { modifierId: MODIFIER_IDS.conscientiousObjector, mark: 'O', label: 'Pacifist' },
  { modifierId: MODIFIER_IDS.berserker, mark: 'B', label: 'Berserker' },
  { modifierId: MODIFIER_IDS.traitor, mark: '!', label: 'Traitor' },
  { modifierId: MODIFIER_IDS.rejectQueen, mark: '»', label: 'Chain ready' },
  { modifierId: MODIFIER_IDS.chancellor, mark: 'C', label: 'Chancellor' },
  { modifierId: MODIFIER_IDS.holyKnight, mark: 'A', label: 'Archbishop in the move list (bishop + knight)' },
  { modifierId: MODIFIER_IDS.elephantInTheRoom, mark: 'E', label: 'Elephant in the move list (moves 1 or 2 diagonally)' },
  { modifierId: MODIFIER_IDS.lawrenceOfArabia, mark: 'L', label: 'Camel in the move list (leaps 3 and 1)' },
  { modifierId: MODIFIER_IDS.knightRider, mark: 'NN', label: 'Nightrider in the move list (knight jumps in a line)' },
  { modifierId: MODIFIER_IDS.overseasHire, mark: 'Cn', label: 'Cannon in the move list (hops one piece to capture)' },
  { modifierId: MODIFIER_IDS.hopscotch, mark: 'Gh', label: 'Grasshopper in the move list (hops one piece, lands behind it)' },
  { modifierId: MODIFIER_IDS.theBodyguard, mark: 'Bg', label: 'Bodyguard in the move list (steps like a King, swaps with it)' },
  {
    modifierId: MODIFIER_IDS.hatchery,
    mark: '10',
    label: "Egg: its side's moves until it hatches",
    showIf: ctx => ctx.eggOnBoard !== false,
  },
  { modifierId: MODIFIER_IDS.commitmentIssues, mark: 'T', label: 'Touched: this piece must move' },
  { modifierId: MODIFIER_IDS.holdMyBread, mark: '◇', label: 'Guarded: cannot be captured this move' },
  { modifierId: MODIFIER_IDS.imposterSyndrome, mark: '…', label: 'Doubting: her next move is only one square' },
  { modifierId: MODIFIER_IDS.slayQueen, mark: '♞', label: 'Amazon: this Queen also moves like a knight' },
  { modifierId: MODIFIER_IDS.threeKings, mark: '⛨', label: 'Royal Guard' },
  { modifierId: MODIFIER_IDS.ventTiles, mark: '●', label: 'Vent shaft' },
  { modifierId: MODIFIER_IDS.heavyIsTheCrown, mark: '♔', label: 'King order' },
  { modifierId: MODIFIER_IDS.hatofulGambit, mark: '◎', label: 'Pigeon hop' },
  { modifierId: MODIFIER_IDS.knownUnknowns, mark: '⬚', label: 'Blind Spot' },
  { modifierId: MODIFIER_IDS.bigBeak, mark: '◉', label: 'Surveillance Square' },
  { modifierId: MODIFIER_IDS.smokeCloud, mark: '☁', label: 'Smoke' },
  { modifierId: MODIFIER_IDS.sus, mark: '?', label: 'Your Sus piece', ownerOnly: true },
  { modifierId: MODIFIER_IDS.bandersnatch, mark: '┃', label: 'Mirror line (twins copy moves)' },
  {
    modifierId: MODIFIER_IDS.noIDontThinkIWill,
    mark: '⇅',
    label: 'Your first 5 moves: click across the board',
    // Gone once the viewer's flipped moves are used up, or when the curse is the opponent's.
    showIf: ctx => ctx.flippedMovesLeft !== 0,
    labelFor: ctx => {
      const verb = ctx.touchScreen ? 'tap' : 'click';
      const left = ctx.flippedMovesLeft;
      if (left === undefined) return `Your first 5 moves: ${verb} across the board`;
      return `${left} flipped move${left === 1 ? '' : 's'} left: ${verb} across the board`;
    },
  },
  { modifierId: MODIFIER_IDS.factoryMustGrow, mark: '⇄', label: 'Conveyor belt: slides pieces one square after each round' },
  { modifierId: MODIFIER_IDS.magicRoundabout, mark: '↻', label: 'Roundabout: pieces turn one step clockwise after each round' },
  { modifierId: MODIFIER_IDS.theRoomba, mark: '◍', label: 'Roomba: goes round the edge, bumps pieces inward' },
  { modifierId: MODIFIER_IDS.oneWayStreet, mark: '↕', label: 'One-way file: move along it only the arrow\'s way' },
  { modifierId: MODIFIER_IDS.forgiveMe, mark: '✝', label: 'Confession and declared square' },
  { modifierId: MODIFIER_IDS.ghosts, mark: '◌', label: 'Your Ghost (faded)' },
];

/** Cards that apply to `viewer`: shared cards and the ones `viewer` drafted. */
export function viewerModifierIds(state: Pick<GameState, 'activeModifiers'>, viewer: Color): string[] {
  return state.activeModifiers
    .filter(mod => mod.sourceColor == null || mod.sourceColor === viewer)
    .map(mod => mod.id);
}

/** Legend rows for the markers that can appear in this match. */
export function getMarkerLegend(
  activeModifierIds: readonly string[],
  ctx: MarkerLegendContext = {},
): MarkerLegendEntry[] {
  return MARKER_LEGEND
    .filter(entry => activeModifierIds.includes(entry.modifierId))
    .filter(entry => !entry.ownerOnly || !ctx.viewerModifierIds || ctx.viewerModifierIds.includes(entry.modifierId))
    .filter(entry => !entry.showIf || entry.showIf(ctx))
    .map(({ mark, label, labelFor }) => ({ mark, label: labelFor ? labelFor(ctx) : label }));
}
