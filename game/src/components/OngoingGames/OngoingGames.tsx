import { useRef, useState } from 'react';
import { playClick } from '../../sound';
import { abandonLabel, describeSave, type OngoingRow } from '../../ongoingGames';
import type { SavedBotGame } from '../../savedBotGames';
import LeaveMatchDialog from '../LeaveMatchDialog/LeaveMatchDialog';
import styles from './OngoingGames.module.css';

interface OngoingGamesProps {
  games: SavedBotGame[];
  onResume: (game: SavedBotGame) => void;
  onAbandon: (game: SavedBotGame) => void;
  onBack: () => void;
  onPlay: () => void;
  /** Why a game just left the list, if one did. */
  notice?: string | null;
  /** Online games, already described. They are resigned from inside the match, not here. */
  online?: OngoingRow[];
  /** A line about the online games: still checking, or the server is out of reach. */
  onlineNote?: string | null;
  onResumeOnline?: (roomId: string) => void;
}

type Entry = { row: OngoingRow; save: SavedBotGame | null };

/** Bot games saved on this device and online games still running, last played first. Tap one to pick it up. */
export default function OngoingGames({
  games,
  onResume,
  onAbandon,
  onBack,
  onPlay,
  notice,
  online = [],
  onlineNote,
  onResumeOnline,
}: OngoingGamesProps) {
  const [confirming, setConfirming] = useState<SavedBotGame | null>(null);
  /** The Abandon button that opened the confirm, so Cancel can hand focus back. */
  const opener = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmRow = confirming ? describeSave(confirming) : null;
  // Bot and online games together, last played first.
  const entries: Entry[] = [
    ...games.map(save => ({ row: describeSave(save), save })),
    ...online.map(row => ({ row, save: null })),
  ].sort((a, b) => b.row.updatedMs - a.row.updatedMs);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <button
          className={styles.back}
          onClick={() => {
            playClick();
            onBack();
          }}
        >
          {'<-'} Back
        </button>
        <h1 ref={heading} tabIndex={-1} className={styles.title}>
          Ongoing games
        </h1>
        <p className={styles.lede}>
          Bot games save after every move. Online games stay open on the server. Pick one up where you left it.
        </p>
        {onlineNote && <p className={styles.lede}>{onlineNote}</p>}
        <p className={styles.notice} role="status">
          {notice ?? ''}
        </p>

        {entries.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.lede}>No games in progress.</p>
            <button
              className={styles.primary}
              onClick={() => {
                playClick();
                onPlay();
              }}
            >
              Play a bot
            </button>
          </div>
        ) : (
          <ul className={styles.list}>
            {entries.map(({ row, save: game }) => {
              return (
                <li key={`${row.kind}-${row.id}`} className={styles.row}>
                  <button
                    className={styles.resume}
                    aria-label={`Resume ${row.kind === 'online' ? 'online ' : ''}game against ${row.opponent}. ${row.status}.${
                      row.lastPlayed ? ` Last played ${row.lastPlayed}.` : ''
                    }`}
                    onClick={() => {
                      playClick();
                      if (game) onResume(game);
                      else onResumeOnline?.(row.id);
                    }}
                  >
                    {row.portrait ? (
                      <img src={row.portrait} alt="" className={styles.portrait} />
                    ) : (
                      <span className={styles.portrait} aria-hidden="true">
                        {row.opponent.slice(0, 1)}
                      </span>
                    )}
                    <span className={styles.info}>
                      <span className={styles.topLine}>
                        <span className={styles.opponent}>{row.opponent}</span>
                        <span className={row.yourMove ? styles.yourMove : styles.status}>{row.status}</span>
                      </span>
                      <span className={styles.meta}>
                        {row.lastPlayed ? `${row.side} · ${row.lastPlayed}` : row.side}
                      </span>
                      {row.modifiers && <span className={styles.mods}>{row.modifiers}</span>}
                    </span>
                  </button>
                  {game && (
                  <button
                    className={styles.abandon}
                    aria-label={abandonLabel(row)}
                    onClick={event => {
                      playClick();
                      opener.current = event.currentTarget;
                      setConfirming(game);
                    }}
                  >
                    Abandon
                  </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirming && confirmRow && (
        <LeaveMatchDialog
          heading="Abandon this game?"
          text={confirmRow.abandonIsLoss ? 'It will count as a loss.' : 'It will be removed from the list.'}
          leaveLabel="Abandon"
          stayLabel="Cancel"
          onStay={() => {
            setConfirming(null);
            opener.current?.focus();
          }}
          onLeave={() => {
            playClick();
            onAbandon(confirming);
            setConfirming(null);
            // The row is gone; start again from the heading.
            heading.current?.focus();
          }}
        />
      )}
    </div>
  );
}
