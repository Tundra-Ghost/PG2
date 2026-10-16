import type { ModifierDefinition } from '../types';
import type { Color, GameState, Square } from '../../engine/types';
import { appendGameEvent, cloneState } from '../../engine/gameLoop';
import { MODIFIER_IDS } from '../ids';

const ID = MODIFIER_IDS.quietQuitting;
const FILES = 'abcdefgh';
/** Opponent turns the zone lasts. */
export const QUIET_ZONE_TURNS = 2;

interface QuietZone {
  queenId: string;
  color: Color;
  center: Square;
  turnsLeft: number;
}

function storedZones(state: GameState): QuietZone[] {
  return (state.modifierState[ID] as QuietZone[] | undefined) ?? [];
}

/** Zones whose queen still sits on the centre. A queen that moves or dies ends her zone. */
function liveZones(state: GameState): QuietZone[] {
  return storedZones(state).filter(zone => state.pieces.get(zone.center)?.id === zone.queenId);
}

function zoneSquares(center: Square): Square[] {
  const f0 = FILES.indexOf(center[0]);
  const r0 = Number(center[1]);
  const squares: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const f = f0 + df;
      const r = r0 + dr;
      if (f >= 0 && f <= 7 && r >= 1 && r <= 8) squares.push(`${FILES[f]}${r}` as Square);
    }
  }
  return squares;
}

/** Squares inside a live zone, with the side that owns each zone. For the board tint. */
export function getQuietZoneSquares(state: GameState): Map<Square, Color> {
  const result = new Map<Square, Color>();
  for (const zone of liveZones(state)) {
    for (const sq of zoneSquares(zone.center)) result.set(sq, zone.color);
  }
  return result;
}

/** MOD-C005: the queen skips her move to keep enemy pieces out of the 3x3 around her. */
export const quietQuittingDef: ModifierDefinition = {
  id: ID,
  name: 'Quiet Quitting',
  category: 'C',
  pointCost: 5,
  curseRating: 0,
  activeFor: 'both',
  draftScope: 'owned',

  ability: {
    label: 'Quiet Quitting',
    hint: 'The queen stays put. Enemy pieces cannot enter the 3x3 around her for 2 of their turns.',
    pieceTypes: ['queen'],
    cooldown: 10,
    getTargets: (_state, piece) => [piece.square],
    apply(state, move) {
      const queen = state.pieces.get(move.from)!;
      const next = cloneState(state);
      next.flags.enPassantSquare = null;
      next.flags.halfMoveClock += 1;
      next.modifierState[ID] = [
        ...liveZones(state).filter(zone => zone.queenId !== queen.id),
        { queenId: queen.id, color: queen.color, center: move.from, turnsLeft: QUIET_ZONE_TURNS },
      ];
      return {
        state: appendGameEvent(next, {
          ply: state.moveHistory.length + 1,
          type: 'modifier',
          modifierId: ID,
          title: 'QUIET QUITTING',
          message: `The ${queen.color} queen on ${move.from} stops working. Nobody may enter her zone.`,
        }),
      };
    },
    notation: (_state, move) => `Q${move.from}=Z`,
  },

  onPreMoveValidate(state, move) {
    for (const zone of liveZones(state)) {
      if (zone.color === move.playerColor) continue;
      if (zoneSquares(zone.center).includes(move.to)) {
        return { blocked: true, reason: 'The queen is Quiet Quitting. Nobody may enter her zone.' };
      }
    }
    return { blocked: false };
  },

  onTurnEnd(state) {
    const zones = storedZones(state);
    if (zones.length === 0) return state;
    // state.turn is the side about to move: the zone owner's opponent just finished a turn.
    const kept = liveZones(state)
      .map(zone => (zone.color === state.turn ? { ...zone, turnsLeft: zone.turnsLeft - 1 } : zone))
      .filter(zone => zone.turnsLeft > 0);
    const next = cloneState(state);
    next.modifierState[ID] = kept;
    return next;
  },
};
