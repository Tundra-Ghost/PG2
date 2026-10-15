import { useEffect, useState } from 'react';
import type { AppSettings } from '../../settings';
import { playClick } from '../../sound';
import { useOnlineRoom } from '../../online/useOnlineRoom';
import Board from '../Board/Board';
import GameStatus from '../GameStatus/GameStatus';
import MoveHistory from '../MoveHistory/MoveHistory';
import PlayerBanner from '../PlayerBanner/PlayerBanner';
import appStyles from '../../App.module.css';
import styles from './OnlineMatch.module.css';

interface OnlineMatchProps {
  playerName: string;
  settings: AppSettings;
  onBack: () => void;
  onSettings: () => void;
}

/**
 * Online two-player match (TDD P0-03 slice). Standard rules, no draft yet.
 * Every move goes to the server; the board only shows what the server sends.
 */
export default function OnlineMatch({ playerName, settings, onBack, onSettings }: OnlineMatchProps) {
  const room = useOnlineRoom();
  const [code, setCode] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (room.error) setInfoMessage(room.error);
  }, [room.error]);

  useEffect(() => {
    if (!infoMessage) return;
    const timer = setTimeout(() => setInfoMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [infoMessage]);

  function leave() {
    room.leave();
    onBack();
  }

  const opponentColor = room.color === 'white' ? 'black' : 'white';
  const opponentSeat = room.seats?.[opponentColor] ?? 'empty';
  const inGame = room.state && room.color && opponentSeat !== 'empty';

  if (!inGame) {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <button className={styles.back} onClick={leave}>&lt;- Back</button>
          <h1 className={styles.title}>Play Online</h1>
          <p className={styles.lede}>Standard chess against a friend. Modifier drafts come next.</p>

          <ConnectionLine connection={room.connection} />

          {room.roomId ? (
            <div className={styles.waiting}>
              <span className={styles.label}>Room code</span>
              <div className={styles.codeRow}>
                <span className={styles.code}>{room.roomId}</span>
                <button
                  className={styles.secondary}
                  onClick={() => {
                    void navigator.clipboard?.writeText(room.roomId ?? '');
                    setCopied(true);
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className={styles.hint}>Send this code to your opponent. You play White. Waiting for them to join.</p>
            </div>
          ) : (
            <>
              <button
                className={styles.primary}
                disabled={room.connection !== 'online'}
                onClick={() => {
                  playClick();
                  room.createRoom();
                }}
              >
                Create Room
              </button>

              <div className={styles.divider}><span>or join one</span></div>

              <form
                className={styles.joinRow}
                onSubmit={event => {
                  event.preventDefault();
                  if (!code.trim()) return;
                  playClick();
                  room.joinRoom(code);
                }}
              >
                <input
                  className={styles.input}
                  value={code}
                  onChange={event => setCode(event.target.value.toUpperCase())}
                  placeholder="Room code"
                  maxLength={5}
                  aria-label="Room code"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <button className={styles.secondary} type="submit" disabled={room.connection !== 'online' || !code.trim()}>
                  Join
                </button>
              </form>
            </>
          )}

          {room.error && <p className={styles.error}>{room.error}</p>}
        </div>
      </div>
    );
  }

  const state = room.state!;
  const myColor = room.color!;
  const opponentAway = opponentSeat === 'disconnected';

  return (
    <div className={appStyles.app}>
      <header className={appStyles.header}>
        <button className={appStyles.menuBtn} onClick={leave}>Menu</button>
        <span className={appStyles.title}>Pigeon Chess</span>
        <span className={appStyles.phase}>Online · {room.roomId}</span>
        <button className={appStyles.settingsBtn} onClick={onSettings}>Settings</button>
      </header>

      <main className={appStyles.main}>
        <section className={appStyles.matchHud}>
          <div className={appStyles.bannerRow}>
            <PlayerBanner
              role={`You · ${myColor === 'white' ? 'White' : 'Black'}`}
              name={playerName}
              subtitle={room.connection === 'online' ? 'Connected' : 'Reconnecting...'}
              badge={state.turn === myColor ? 'To Move' : 'Waiting'}
              portraitLabel={playerName.slice(0, 1).toUpperCase()}
            />
            <PlayerBanner
              role={`Opponent · ${opponentColor === 'white' ? 'White' : 'Black'}`}
              name="Opponent"
              subtitle={opponentAway ? 'Disconnected. Their seat is held for them.' : 'Connected'}
              badge={state.turn === opponentColor ? 'To Move' : 'Standing By'}
              portraitLabel="O"
              align="right"
            />
          </div>

          <div className={styles.stageRow}>
            <div className={appStyles.logDock}>
              <MoveHistory
                state={state}
                whiteLabel={myColor === 'white' ? playerName : 'Opponent'}
                blackLabel={myColor === 'black' ? playerName : 'Opponent'}
              />
            </div>

            <div className={appStyles.boardOnly}>
              <div className={appStyles.boardShell}>
                <Board
                  state={state}
                  onMove={room.sendMove}
                  onShooGerald={room.shooGerald}
                  controlColor={myColor}
                  orientation={myColor}
                  onInfo={setInfoMessage}
                  showLegalMoves={settings.showLegalMoves}
                  autoQueen={settings.autoQueen}
                  showCoordinates={settings.showCoordinates}
                />
              </div>
            </div>
          </div>

          <div className={appStyles.gameFooter}>
            <GameStatus
              state={state}
              onNewGame={leave}
              infoMessage={infoMessage ?? (opponentAway ? 'Opponent disconnected.' : null)}
              actionLabel="Leave Room"
              controls={
                <MatchControls
                  myColor={myColor}
                  drawOffer={room.drawOffer}
                  confirmResign={settings.confirmResign}
                  onResign={room.resign}
                  onOfferDraw={room.offerDraw}
                  onAnswerDraw={room.answerDraw}
                />
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}

interface MatchControlsProps {
  myColor: 'white' | 'black';
  drawOffer: 'white' | 'black' | null;
  confirmResign: boolean;
  onResign: () => void;
  onOfferDraw: () => void;
  onAnswerDraw: (accept: boolean) => void;
}

/** Resign and draw offer buttons for an online match (TDD §05). */
function MatchControls({ myColor, drawOffer, confirmResign, onResign, onOfferDraw, onAnswerDraw }: MatchControlsProps) {
  const [confirming, setConfirming] = useState(false);

  if (drawOffer && drawOffer !== myColor) {
    return (
      <div className={styles.controls} role="group" aria-label="Draw offer">
        <span className={styles.controlsText}>Opponent offers a draw.</span>
        <button className={styles.controlBtn} onClick={() => { playClick(); onAnswerDraw(true); }}>Accept</button>
        <button className={styles.controlBtn} onClick={() => { playClick(); onAnswerDraw(false); }}>Decline</button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className={styles.controls} role="group" aria-label="Confirm resign">
        <span className={styles.controlsText}>Resign this game?</span>
        <button className={styles.controlBtn} onClick={() => { playClick(); setConfirming(false); onResign(); }}>Resign</button>
        <button className={styles.controlBtn} onClick={() => { playClick(); setConfirming(false); }}>Keep playing</button>
      </div>
    );
  }

  return (
    <div className={styles.controls}>
      <button
        className={styles.controlBtn}
        disabled={drawOffer === myColor}
        onClick={() => { playClick(); onOfferDraw(); }}
      >
        {drawOffer === myColor ? 'Draw offered' : 'Offer draw'}
      </button>
      <button
        className={styles.controlBtn}
        onClick={() => {
          playClick();
          if (confirmResign) setConfirming(true);
          else onResign();
        }}
      >
        Resign
      </button>
    </div>
  );
}

function ConnectionLine({ connection }: { connection: 'connecting' | 'online' | 'offline' }) {
  if (connection === 'online') return <p className={styles.online}>Connected to the game server.</p>;
  if (connection === 'connecting') return <p className={styles.hint}>Connecting to the game server...</p>;
  return (
    <p className={styles.error}>
      Can't reach the game server. It is not hosted yet. To test locally, run <code>pnpm dev:server</code>.
    </p>
  );
}
