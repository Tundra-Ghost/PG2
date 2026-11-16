import { useState } from 'react';
import { playClick } from '../../sound';
import { describeSave } from '../../ongoingGames';
import type { SavedBotGame } from '../../savedBotGames';
import LeaveMatchDialog from '../LeaveMatchDialog/LeaveMatchDialog';
import styles from './OngoingGames.module.css';

interface OngoingGamesProps {
  games: SavedBotGame[];
  onResume: (game: SavedBotGame) => void;
  onAbandon: (game: SavedBotGame) => void;
  onBack: () => void;
  onPlay: () => void;
}

/** Every bot game in progress on this device, last played first. Tap one to pick it up. */
export default function OngoingGames({ games, onResume, onAbandon, onBack, onPlay }: OngoingGamesProps) {
  const [confirming, setConfirming] = useState<SavedBotGame | null>(null);
  const confirmRow = confirming ? describeSave(confirming) : null;

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
        <h1 className={styles.title}>Ongoing games</h1>
        <p className={styles.lede}>Games against bots save after every move. Pick one up where you left it.</p>

        {games.length === 0 ? (
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
            {games.map(game => {
              const row = describeSave(game);
              return (
                <li key={game.id} className={styles.row}>
                  <button
                    className={styles.resume}
                    aria-label={`Resume game against ${row.opponent}. ${row.status}. Last played ${row.lastPlayed}.`}
                    onClick={() => {
                      playClick();
                      onResume(game);
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
                        {row.side} · {row.lastPlayed}
                      </span>
                      <span className={styles.mods}>{row.modifiers}</span>
                    </span>
                  </button>
                  <button
                    className={styles.abandon}
                    aria-label={`Abandon game against ${row.opponent}`}
                    onClick={() => {
                      playClick();
                      setConfirming(game);
                    }}
                  >
                    Abandon
                  </button>
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
          onStay={() => setConfirming(null)}
          onLeave={() => {
            playClick();
            onAbandon(confirming);
            setConfirming(null);
          }}
        />
      )}
    </div>
  );
}
