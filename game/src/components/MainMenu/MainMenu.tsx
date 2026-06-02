import {
  getFavoriteModifiers,
  getProfileLevel,
  getSelectedTitle,
  type LocalProfile,
} from '../../profile';
import { ALL_MODIFIERS } from '../../modifiers/data';
import { playClick } from '../../sound';
import styles from './MainMenu.module.css';

interface MainMenuProps {
  onPlay: (mode: 'run' | 'quick') => void;
  onSettings: () => void;
  onProfile: () => void;
  onRoost: () => void;
  onCollection: () => void;
  profile: LocalProfile | null;
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
  profile,
}: MainMenuProps) {
  const profileLevel = profile ? getProfileLevel(profile) : 1;
  const selectedTitle = profile ? getSelectedTitle(profile).name : 'Street Pigeon';
  const favoriteModifierId = profile ? getFavoriteModifiers(profile, 'all')[0] ?? null : null;
  const favoriteModifierName = favoriteModifierId ? getModifierName(favoriteModifierId) : 'None yet';
  const profileName = profile?.displayName ?? 'Create Profile';
  const profileInitial = profile?.displayName?.slice(0, 1).toUpperCase() ?? 'P';

  const cards: MenuCard[] = [
    {
      id: 'story',
      label: 'Play',
      detail: 'Start a story run with bot select and modifier drafting.',
      status: 'live',
      tone: 'olive',
      size: 'standard',
      artClass: 'artStory',
      action: () => onPlay('run'),
    },
    {
      id: 'puzzles',
      label: 'Puzzles',
      detail: 'Test your tactics with curated puzzle positions.',
      status: 'soon',
      tone: 'sand',
      size: 'standard',
      artClass: 'artPuzzles',
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
      detail: 'Ranked, casual, and direct challenges.',
      status: 'soon',
      tone: 'blue',
      size: 'standard',
      artClass: 'artOnline',
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
              {profile?.avatarDataUrl ? (
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
                <span className={styles.profileName}>{profileName}</span>
                <span className={styles.profileMeta}>
                  Lv {profileLevel} / ELO {profile?.elo ?? 1200} / {selectedTitle}
                </span>
              </span>
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
