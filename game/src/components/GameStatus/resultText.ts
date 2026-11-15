import { getWinner, type GameState } from '@pigeon-chess/game-core';

type Side = 'white' | 'black';

/** Who the player is, so the result can say "You win" or "Chick wins" instead of a colour. */
export interface ResultSides {
  you?: Side;
  names?: Partial<Record<Side, string>>;
}

function sideName(side: Side, sides: ResultSides | undefined): string {
  if (sides?.you === side) return 'You';
  return sides?.names?.[side] ?? (side === 'white' ? 'White' : 'Black');
}

const DRAW_LABELS: Record<string, string> = {
  stalemate:   'by stalemate',
  '50-move':   '50-move rule',
  threefold:   'threefold repetition',
  insufficient: 'insufficient material',
  agreement:   'by agreement',
};

/** The result card's text for a finished game, or null while it is still going. */
export function getStatusMessage(
  state: GameState,
  sides?: ResultSides,
): { emoji: string; headline: string; sub: string } | null {
  const winner = getWinner(state);
  if (winner && winner !== 'draw') {
    const resigned = state.resignedBy as Side | undefined;
    return {
      emoji: winner === 'white' ? '♔' : '♚',
      headline: sides?.you === winner ? 'You win' : `${sideName(winner, sides)} wins`,
      sub:
        state.status === 'resigned'
          ? resigned
            ? `${sideName(resigned, sides)} resigned`
            : 'by resignation'
          : 'by checkmate',
    };
  }
  if (winner === 'draw') {
    const label = DRAW_LABELS[state.drawReason ?? 'stalemate'] ?? 'draw';
    return { emoji: '🕊️', headline: 'Draw', sub: label };
  }
  return null;
}
