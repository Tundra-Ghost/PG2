import type { Color, OnlineDraft } from '@pigeon-chess/game-core';

export interface DraftView {
  myPicks: string[];
  theirPicks: string[];
  turn: 'player' | 'opponent' | 'done';
  iAmDone: boolean;
}

/** The server's draft from one player's side of the table. */
export function draftViewFor(draft: OnlineDraft, myColor: Color): DraftView {
  const theirColor: Color = myColor === 'white' ? 'black' : 'white';
  return {
    myPicks: draft.picks[myColor],
    theirPicks: draft.picks[theirColor],
    turn: draft.turn === null ? 'done' : draft.turn === myColor ? 'player' : 'opponent',
    iAmDone: draft.done[myColor],
  };
}
