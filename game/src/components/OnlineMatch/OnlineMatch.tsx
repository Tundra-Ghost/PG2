import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Color, GameSummary } from '@pigeon-chess/game-core';
import type { MatchChatEntry } from '../../matchFeed';
import type { AppSettings } from '../../settings';
import { playClick } from '../../sound';
import { useOnlineRoom } from '../../online/useOnlineRoom';
import { draftViewFor } from '../../online/draftView';
import { isFinished, resultFor, type GameSurveyContext } from '../../online/survey';
import PostGameSurvey from '../PostGameSurvey/PostGameSurvey';
import Board from '../Board/Board';
import DraftScreen from '../DraftScreen/DraftScreen';
import GameStatus from '../GameStatus/GameStatus';
import MoveHistory from '../MoveHistory/MoveHistory';
import PlayerBanner from '../PlayerBanner/PlayerBanner';
import appStyles from '../../App.module.css';
import styles from './OnlineMatch.module.css';

interface OnlineMatchProps {
  playerName: string;
  /** The signed-in account, or null for a guest. */
  account: string | null;
  /** A room to sit down in once connected (from a friend's invite or a challenge). */
  joinRoomId?: string | null;
  onJoined?: () => void;
  /** Turns post-game surveys off (from the survey's "don't ask" link). */
  onStopSurveys: () => void;
  settings: AppSettings;
  onBack: () => void;
  onSettings: () => void;
}

/**
 * Online two-player match (TDD P0-03, with the P1-03 modifier draft).
 * Every pick and move goes to the server; the screen only shows what the server sends.
 */
export default function OnlineMatch({
  playerName,
  account,
  joinRoomId,
  onJoined,
  onStopSurveys,
  settings,
  onBack,
  onSettings,
}: OnlineMatchProps) {
  const room = useOnlineRoom(account);
  const [surveyFor, setSurveyFor] = useState<GameSurveyContext | null>(null);
  /** The last status seen per room, so only a game that ends while watched asks. */
  const lastStatus = useRef<{ roomId: string; status: string } | null>(null);

  useEffect(() => {
    const state = room.state;
    if (!state || !room.roomId || !room.color) return;
    const previous = lastStatus.current;
    lastStatus.current = { roomId: room.roomId, status: state.status };
    if (!settings.postGameSurveys || !isFinished(state)) return;
    if (!previous || previous.roomId !== room.roomId || previous.status !== 'active') return;
    const context: GameSurveyContext = {
      mode: 'online',
      modifierIds: state.activeModifiers.map(mod => mod.id),
      result: resultFor(state, room.color),
      details: { room: room.roomId, moves: state.moveHistory.length, ending: state.status, signedIn: Boolean(account) },
    };
    const timer = setTimeout(() => setSurveyFor(context), 1500);
    return () => clearTimeout(timer);
  }, [room.state, room.roomId, room.color, settings.postGameSurveys, account]);

  useEffect(() => {
    if (!joinRoomId || room.connection !== 'online') return;
    room.resumeGame(joinRoomId);
    onJoined?.();
  }, [joinRoomId, room.connection, room.resumeGame, onJoined]);
  const [code, setCode] = useState('');
  const [withDraft, setWithDraft] = useState(true);
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
          <p className={styles.lede}>Play a friend. Draft modifiers first, or play standard chess.</p>

          <ConnectionLine connection={room.connection} />
          <p className={styles.hint}>
            {account
              ? `Signed in as ${account}. Your games follow you to any device.`
              : 'Playing as a guest: games are saved on this device. Sign in under Settings > Account to keep them on every device.'}
          </p>

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
              <p className={styles.hint}>
                Send this code to your opponent. You play White.
                {room.draft ? ' You both draft modifiers once they join.' : ''} Waiting for them to join.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.modeRow} role="radiogroup" aria-label="Game type">
                {[
                  { draft: true, label: 'Modifier draft' },
                  { draft: false, label: 'Standard chess' },
                ].map(option => (
                  <button
                    key={option.label}
                    role="radio"
                    aria-checked={withDraft === option.draft}
                    className={`${styles.modeBtn} ${withDraft === option.draft ? styles.modeOn : ''}`}
                    onClick={() => {
                      playClick();
                      setWithDraft(option.draft);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                className={styles.primary}
                disabled={room.connection !== 'online'}
                onClick={() => {
                  playClick();
                  room.createRoom(withDraft);
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

          {!room.roomId && room.savedGames.length > 0 && (
            <SavedGames
              games={room.savedGames}
              onResume={room.resumeGame}
              onForget={account ? undefined : room.forgetGame}
            />
          )}

          {room.error && <p className={styles.error}>{room.error}</p>}
        </div>
      </div>
    );
  }

  const state = room.state!;
  const myColor = room.color!;
  const opponentAway = opponentSeat === 'disconnected';
  const opponentName = room.names?.[opponentColor] ?? 'Opponent';
  const chatEntries = toChatEntries(room.chat, myColor, playerName, opponentName);

  if (room.draft && room.draft.turn !== null) {
    const draft = room.draft;
    return (
      <>
        <DraftScreen
          opponentName={opponentName}
          onBack={leave}
          online={{
            ...draftViewFor(draft, myColor),
            onPick: room.draftPick,
            onFinish: room.draftFinish,
          }}
        />
        {infoMessage && <p className={styles.draftError} role="alert">{infoMessage}</p>}
      </>
    );
  }

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
            <div className={appStyles.selfSlot}>
            <PlayerBanner
              role={`You · ${myColor === 'white' ? 'White' : 'Black'}`}
              name={playerName}
              subtitle={room.connection === 'online' ? 'Connected' : 'Reconnecting...'}
              badge={state.turn === myColor ? 'To Move' : 'Waiting'}
              portraitLabel={playerName.slice(0, 1).toUpperCase()}
            />
            </div>
            <div className={appStyles.opponentSlot}>
            <PlayerBanner
              role={`Opponent · ${opponentColor === 'white' ? 'White' : 'Black'}`}
              name={opponentName}
              subtitle={opponentAway ? 'Disconnected. Their seat is held for them.' : 'Connected'}
              badge={state.turn === opponentColor ? 'To Move' : 'Standing By'}
              portraitLabel={opponentName.slice(0, 1).toUpperCase()}
              align="right"
            />
            </div>
          </div>

          {room.drawOffer === opponentColor && state.status === 'active' && (
            // On phones the status bar sits below the board and chat, so the
            // offer is repeated right above the board where it can't be missed.
            <div className={styles.drawBanner} role="alert">
              <span>{opponentName} offers a draw.</span>
              <button className={styles.controlBtn} onClick={() => { playClick(); room.answerDraw(true); }}>Accept</button>
              <button className={styles.controlBtn} onClick={() => { playClick(); room.answerDraw(false); }}>Decline</button>
            </div>
          )}

          <div className={styles.stageRow}>
            <div className={appStyles.logDock}>
              <MoveHistory
                state={state}
                whiteLabel={myColor === 'white' ? playerName : opponentName}
                blackLabel={myColor === 'black' ? playerName : opponentName}
                chatEntries={chatEntries}
                onSendChat={room.sendChat}
                viewerColor={myColor}
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
      {surveyFor && (
        <PostGameSurvey context={surveyFor} onClose={() => setSurveyFor(null)} onStopAsking={onStopSurveys} />
      )}
    </div>
  );
}

/** Server chat as match-log entries, placed after the move they were sent on. */
function toChatEntries(messages: ChatMessage[], myColor: Color, myName: string, opponentName: string): MatchChatEntry[] {
  const perPly = new Map<number, number>();
  return messages.map(message => {
    const index = perPly.get(message.ply) ?? 0;
    perPly.set(message.ply, index + 1);
    const mine = message.color === myColor;
    const author = mine ? myName : opponentName;
    return {
      id: message.id,
      // Moves sit at ply * 100 and modifier events just after; chat follows them.
      order: message.ply * 100 + 60 + Math.min(index, 39),
      ply: message.ply,
      author,
      text: message.text,
      source: mine ? 'player' : 'bot',
      sourceLabel: 'Opponent',
      avatarLabel: author.slice(0, 1).toUpperCase(),
      shownInDialogue: true,
    };
  });
}

function moveLabel(plies: number): string {
  const moves = Math.ceil(plies / 2);
  return moves === 1 ? '1 move' : `${moves} moves`;
}

function gameStatusText(game: GameSummary): { text: string; yourTurn: boolean } {
  if (game.status !== 'active') return { text: 'Finished', yourTurn: false };
  if (!game.opponentJoined) return { text: 'Waiting for opponent', yourTurn: false };
  return game.turn === game.color
    ? { text: 'Your turn', yourTurn: true }
    : { text: 'Their turn', yourTurn: false };
}

interface SavedGamesProps {
  games: GameSummary[];
  onResume: (roomId: string) => void;
  /** Left out for signed-in players: their games live on the account until they expire. */
  onForget?: (roomId: string) => void;
}

/** Games this browser or account can pick back up, so a match can run over several days. */
function SavedGames({ games, onResume, onForget }: SavedGamesProps) {
  return (
    <section className={styles.savedGames} aria-label="Your games">
      <div className={styles.divider}><span>your games</span></div>
      {games.map(game => {
        const status = gameStatusText(game);
        return (
          <div key={game.roomId} className={styles.savedRow}>
            <div className={styles.savedInfo}>
              <span className={styles.savedCode}>{game.roomId}</span>
              <span className={styles.savedMeta}>
                {game.color === 'white' ? 'White' : 'Black'}
                {game.opponentName ? ` vs ${game.opponentName}` : ''} · {moveLabel(game.moveCount)}
              </span>
            </div>
            <span className={status.yourTurn ? styles.yourTurn : styles.savedStatus}>{status.text}</span>
            <button className={styles.secondary} onClick={() => { playClick(); onResume(game.roomId); }}>
              {game.status === 'active' ? 'Resume' : 'View'}
            </button>
            {onForget && (
              <button
                className={styles.forget}
                aria-label={`Remove game ${game.roomId}`}
                onClick={() => onForget(game.roomId)}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <p className={styles.hint}>Games are saved after every move. A game with no moves for 14 days is deleted.</p>
    </section>
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
