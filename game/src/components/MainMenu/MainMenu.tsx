import {
  getFavoriteModifiers,
  getProfileLevel,
  getSelectedTitle,
  type LocalProfile,
} from '../../profile';
import { ALL_MODIFIERS } from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import styles from './MainMenu.module.css';

interface MainMenuProps {
  onPlay: (mode: 'run' | 'quick') => void;
  onSettings: () => void;
  onProfile: () => void;
  onRoost: () => void;
  onCollection: () => void;
  onPuzzles: () => void;
  onOnline: () => void;
  onFriends: () => void;
  onLinkAccount: () => void;
  /** Signed in (or still checking). False shows the guest prompt. */
  linked: boolean;
  /** Friend requests plus unread messages; 0 hides the badge. */
  friendsBadge: number;
  profile: LocalProfile;
}

type CardTone = 'olive' | 'blue' | 'sand' | 'plum' | 'slate' | 'steel';
type CardSize = 'standard' | 'settings';

interface MenuCard {
  id: string;
  label: string;
  detail: string;
  status: 'live' | 'soon';
  tone: CardTone;
  size: CardSize;
  artClass: string;
  action?: () => void;
}

const LIVE_MODIFIER_COUNT = 5;

function getModifierName(id: string): string {
  return ALL_MODIFIERS.find(mod => mod.id === id)?.name ?? id;
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ModeCard({ card }: { card: MenuCard }) {
  const isDisabled = card.status === 'soon' || !card.action;
  const cardClass = [
    styles.modeCard,
    styles[`tone${cap(card.tone)}`],
    styles[`size${cap(card.size)}`],
    styles[`card${cap(card.id)}`],
    isDisabled ? styles.cardDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cardClass}
      data-menu-card={card.id}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled || !card.action) return;
        playClick();
        card.action();
      }}
    >
      <span className={styles.cardCopy}>
        <span className={styles.cardLabel}>{card.label}</span>
        <span className={styles.cardDetail}>{card.detail}</span>
        <span className={styles.cardArrow} aria-hidden="true">
          {'>'}
        </span>
      </span>

      <span className={`${styles.cardArtSlot} ${styles[card.artClass]}`} aria-hidden="true">
        <span className={styles.artFallback}>
          <span className={styles.artBoard} />
          <span className={styles.artPiece} />
          <span className={styles.artAccent} />
        </span>
      </span>

      {card.status === 'soon' && <span className={styles.soonBadge}>Soon</span>}
    </button>
  );
}

export default function MainMenu({
  onPlay,
  onSettings,
  onProfile,
  onRoost,
  onCollection,
  onPuzzles,
  onOnline,
  onFriends,
  onLinkAccount,
  linked,
  friendsBadge,
  profile,
}: MainMenuProps) {
  const profileLevel = getProfileLevel(profile);
  const selectedTitle = getSelectedTitle(profile).name;
  const favoriteModifierId = getFavoriteModifiers(profile, 'all')[0] ?? null;
  const favoriteModifierName = favoriteModifierId ? getModifierName(favoriteModifierId) : 'None yet';
  const profileName = profile.displayName || 'Player';
  const profileInitial = profileName.slice(0, 1).toUpperCase();

  const cards: MenuCard[] = [
    {
      id: 'story',
      label: 'Play',
      detail: 'Play a bot, with a modifier draft or standard chess.',
      status: 'live',
      tone: 'olive',
      size: 'standard',
      artClass: 'artStory',
      action: () => onPlay('run'),
    },
    {
      id: 'puzzles',
      label: 'Puzzles',
      detail: 'Build modifier puzzles and share them with a code.',
      status: 'live',
      tone: 'sand',
      size: 'standard',
      artClass: 'artPuzzles',
      action: onPuzzles,
    },
    {
      id: 'stats',
      label: 'Stats',
      detail: 'Review local profile records, titles, and history.',
      status: 'live',
      tone: 'olive',
      size: 'standard',
      artClass: 'artStats',
      action: onRoost,
    },
    {
      id: 'collection',
      label: 'Collection',
      detail: 'Pieces, boards, and modifier vault.',
      status: 'live',
      tone: 'plum',
      size: 'standard',
      artClass: 'artCollection',
      action: onCollection,
    },
    {
      id: 'online',
      label: 'Online',
      detail: 'Play a friend with a room code.',
      status: 'live',
      tone: 'blue',
      size: 'standard',
      artClass: 'artOnline',
      action: onOnline,
    },
    {
      id: 'settings',
      label: 'Settings',
      detail: 'Adjust audio, board display, and gameplay options.',
      status: 'live',
      tone: 'slate',
      size: 'settings',
      artClass: 'artSettings',
      action: onSettings,
    },
  ];

  return (
    <div className={styles.root}>
      {/* Quick access, always in reach. The larger buttons below stay too. */}
      <nav className={styles.quickBar} aria-label="Quick access">
        <button
          type="button"
          className={styles.quickButton}
          aria-label={`Profile: ${profileName}`}
          title="Profile"
          onClick={() => {
            playClick();
            onProfile();
          }}
        >
          {profile.avatarDataUrl ? (
            <img src={profile.avatarDataUrl} alt="" className={styles.quickAvatar} />
          ) : (
            <span className={styles.quickInitial} aria-hidden="true">{profileInitial}</span>
          )}
        </button>
        <button
          type="button"
          className={styles.quickButton}
          aria-label="Settings"
          title="Settings"
          onClick={() => {
            playClick();
            onSettings();
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={styles.quickIcon}>
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.31-.09.63-.09.94s.02.63.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
            />
          </svg>
        </button>
      </nav>
      <div className={styles.scroll}>
        <main className={styles.poster} aria-label="Pigeon Chess main menu">
          <section className={styles.brandPanel} aria-labelledby="main-menu-title">
            <div className={styles.brandMark} aria-hidden="true">
              {'\u2654'}
            </div>
            <h1 id="main-menu-title" className={styles.brandTitle}>
              <span>Pigeon</span>
              <span>Chess</span>
            </h1>
            <p className={styles.brandSubtitle}>
              Local roguelike chess with strange modifiers, persistent records, and one very
              confident bot.
            </p>

            <button
              type="button"
              className={styles.profileButton}
              onClick={() => {
                playClick();
                onProfile();
              }}
            >
              {profile.avatarDataUrl ? (
                <img
                  src={profile.avatarDataUrl}
                  alt={`${profile.displayName} avatar`}
                  className={styles.profileImage}
                />
              ) : (
                <span className={styles.profileInitial} aria-hidden="true">
                  {profileInitial}
                </span>
              )}
              <span className={styles.profileText}>
                <span className={styles.profileName}>
                  {profileName}
                  {!linked && <span className={styles.guestTag}>Guest</span>}
                </span>
                <span className={styles.profileMeta}>
                  Lv {profileLevel} / ELO {profile.elo} / {selectedTitle}
                </span>
              </span>
            </button>

            {!linked && (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  playClick();
                  onLinkAccount();
                }}
              >
                <span>Link account</span>
                <span className={styles.linkHint}>Save progress and play online</span>
              </button>
            )}

            <button
              type="button"
              className={styles.friendsButton}
              onClick={() => {
                playClick();
                onFriends();
              }}
            >
              <span>Friends</span>
              {friendsBadge > 0 && (
                <span className={styles.friendsBadge} aria-label={`${friendsBadge} new`}>{friendsBadge}</span>
              )}
            </button>

            <dl className={styles.brandStats}>
              <div>
                <dt>Live Mods</dt>
                <dd>{LIVE_MODIFIER_COUNT}</dd>
              </div>
              <div>
                <dt>Favorite</dt>
                <dd>{favoriteModifierName}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.cardDeck} aria-label="Game modes">
            {cards.map(card => (
              <ModeCard key={card.id} card={card} />
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
