import type { LocalProfile } from '../../profile';
import { ALL_MODIFIERS } from '../../modifiers/data';
import styles from './MainMenu.module.css';

interface MainMenuProps {
  onPlay: (mode: 'run' | 'quick') => void;
  onSettings: () => void;
  onProfile: () => void;
  profile: LocalProfile | null;
}

interface MenuCard {
  label: string;
  sub: string;
  action?: () => void;
  status?: 'live' | 'soon';
  accent?: 'gold' | 'stone' | 'ember';
}

interface ArtSlot {
  label: string;
  note: string;
  className: string;
}

const LEFT_RAIL: MenuCard[] = [
  {
    label: 'Story Mode',
    sub: 'New Run · Five Towers · Modifier Draft',
    status: 'live',
    accent: 'gold',
  },
  {
    label: 'Quick Play',
    sub: 'Standard board · No draft · Fast testing',
    status: 'live',
    accent: 'stone',
  },
  {
    label: 'Collection',
    sub: 'Pieces, boards, modifiers, and long-term unlocks',
    status: 'soon',
    accent: 'stone',
  },
];

const RIGHT_RAIL: MenuCard[] = [
  {
    label: 'Online',
    sub: 'Ranked, casual, and direct challenges',
    status: 'soon',
    accent: 'ember',
  },
  {
    label: 'The Roost',
    sub: 'Run history, profile records, and long-form stats',
    status: 'soon',
    accent: 'stone',
  },
  {
    label: 'Settings',
    sub: 'Audio, display, gameplay, and accessibility',
    status: 'live',
    accent: 'stone',
  },
];

const JOURNEY_STEPS = [
  {
    title: '1. Set Your Flight',
    body: 'Create a local profile, choose your opponent, and set the run tone before the board ever opens.',
    artLabel: 'Flight Art',
    artNote: 'Scene panel · setup',
  },
  {
    title: '2. Draft The Chaos',
    body: 'Pick your modifier package, let Chick grab its own nonsense, and enter the match with visible ownership.',
    artLabel: 'Draft Art',
    artNote: 'Scene panel · mid flow',
  },
  {
    title: '3. Land And Challenge',
    body: 'Track outcomes, modifier events, and local progression while the prototype stays fully device-side.',
    artLabel: 'Challenge Art',
    artNote: 'Scene panel · payoff',
  },
];

const STAGE_ART_SLOTS: ArtSlot[] = [
  {
    label: 'Park Backdrop',
    note: 'Wide environment art',
    className: 'slotBackdrop',
  },
  {
    label: 'Hero Character',
    note: 'Main illustrated figure',
    className: 'slotCharacter',
  },
  {
    label: 'Board Table',
    note: 'Chessboard prop cluster',
    className: 'slotBoardProp',
  },
  {
    label: 'Bench / Side Prop',
    note: 'Secondary supporting prop',
    className: 'slotSideProp',
  },
];

export default function MainMenu({
  onPlay,
  onSettings,
  onProfile,
  profile,
}: MainMenuProps) {
  const favoriteModifierName = profile?.stats.favoriteModifierId
    ? (ALL_MODIFIERS.find(mod => mod.id === profile.stats.favoriteModifierId)?.name ?? 'Unknown')
    : 'None yet';

  const profileSummary = profile
    ? `${profile.stats.runsPlayed} runs · ${profile.stats.wins} wins`
    : 'No profile yet';

  const leftRail = LEFT_RAIL.map(item => ({
    ...item,
    action:
      item.label === 'Story Mode'
        ? () => onPlay('run')
        : item.label === 'Quick Play'
          ? () => onPlay('quick')
          : undefined,
  }));

  const rightRail = RIGHT_RAIL.map(item => ({
    ...item,
    action:
      item.label === 'Settings'
        ? onSettings
        : undefined,
  }));

  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div className={styles.shell}>
          <header className={styles.topBar}>
            <button className={styles.profileBanner} onClick={onProfile}>
              <span className={styles.profilePortrait} aria-hidden="true">
                {profile?.displayName?.slice(0, 1).toUpperCase() ?? 'P'}
              </span>
              <span className={styles.profileBody}>
                <span className={styles.profileTitle}>
                  {profile?.displayName ?? 'Create Profile'}
                </span>
                <span className={styles.profileMeta}>{profileSummary}</span>
                <span className={styles.profileFlavor}>
                  {profile?.motto || 'Local profile stored on this device.'}
                </span>
              </span>
            </button>

            <div className={styles.utilityBar}>
              <div className={styles.utilityChip}>
                <span className={styles.utilityValue}>5</span>
                <span className={styles.utilityLabel}>Live Mods</span>
              </div>
              <div className={styles.utilityChip}>
                <span className={styles.utilityValue}>{profile?.stats.wins ?? 0}</span>
                <span className={styles.utilityLabel}>Wins</span>
              </div>
              <button className={styles.utilityBtn} onClick={onSettings}>
                Settings
              </button>
            </div>
          </header>

          <main className={styles.hubGrid}>
            <aside className={styles.rail} aria-label="Primary modes">
              {leftRail.map(item => (
                <button
                  key={item.label}
                  className={`${styles.railCard} ${styles[`accent${item.accent === 'stone' ? 'Stone' : item.accent === 'ember' ? 'Ember' : 'Gold'}`]} ${item.status === 'soon' ? styles.railCardLocked : ''}`}
                  onClick={item.action}
                  disabled={item.status === 'soon'}
                >
                  <span className={styles.railCardLabel}>{item.label}</span>
                  <span className={styles.railCardSub}>{item.sub}</span>
                  <span className={styles.railCardState}>
                    {item.status === 'soon' ? 'Soon' : 'Live'}
                  </span>
                </button>
              ))}
            </aside>

            <section className={styles.centerStage} aria-label="Main menu stage">
              <div className={styles.sceneFrame}>
                <div className={styles.sceneSky} />
                <div className={styles.sceneTrees} />
                <div className={styles.sceneSlots} aria-hidden="true">
                  {STAGE_ART_SLOTS.map(slot => (
                    <div
                      key={slot.label}
                      className={`${styles.artSlot} ${styles[slot.className]}`}
                    >
                      <span className={styles.artSlotLabel}>{slot.label}</span>
                      <span className={styles.artSlotNote}>{slot.note}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.sceneBoard}>
                  <div className={styles.boardHeader}>
                    <span className={styles.boardHeaderLabel}>Current Build</span>
                    <span className={styles.boardHeaderValue}>Phase 0 Prototype</span>
                  </div>

                  <div className={styles.stageCopy}>
                    <span className={styles.stageKicker}>Pigeon Chess</span>
                    <h1 className={styles.stageTitle}>Play Game</h1>
                    <p className={styles.stageSub}>
                      A local-first roguelike chess prototype with draftable modifiers, bot selection, readable curses, and persistent local identity.
                    </p>
                  </div>

                  <div className={styles.stageActions}>
                    <button className={styles.primaryAction} onClick={() => onPlay('run')}>
                      Start Story Run
                    </button>
                    <button className={styles.secondaryAction} onClick={() => onPlay('quick')}>
                      Quick Skirmish
                    </button>
                  </div>

                  <div className={styles.stageFooter}>
                    <div className={styles.stageStat}>
                      <span className={styles.stageStatLabel}>Favorite Modifier</span>
                      <span className={styles.stageStatValue}>{favoriteModifierName}</span>
                    </div>
                    <div className={styles.stageStat}>
                      <span className={styles.stageStatLabel}>Profile Status</span>
                      <span className={styles.stageStatValue}>
                        {profile ? 'Configured' : 'Awaiting setup'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className={styles.rail} aria-label="Secondary modes">
              {rightRail.map(item => (
                <button
                  key={item.label}
                  className={`${styles.railCard} ${styles[`accent${item.accent === 'stone' ? 'Stone' : item.accent === 'ember' ? 'Ember' : 'Gold'}`]} ${item.status === 'soon' ? styles.railCardLocked : ''}`}
                  onClick={item.action}
                  disabled={item.status === 'soon'}
                >
                  <span className={styles.railCardLabel}>{item.label}</span>
                  <span className={styles.railCardSub}>{item.sub}</span>
                  <span className={styles.railCardState}>
                    {item.status === 'soon' ? 'Soon' : 'Live'}
                  </span>
                </button>
              ))}
            </aside>
          </main>

          <section className={styles.journeyBand} aria-label="Run structure">
            {JOURNEY_STEPS.map(step => (
              <article key={step.title} className={styles.stepCard}>
                <div className={styles.stepArt} aria-hidden="true">
                  <span className={styles.stepArtLabel}>{step.artLabel}</span>
                  <span className={styles.stepArtNote}>{step.artNote}</span>
                </div>
                <span className={styles.stepTitle}>{step.title}</span>
                <p className={styles.stepBody}>{step.body}</p>
              </article>
            ))}
          </section>

          <footer className={styles.footer}>
            <div className={styles.footerBlock}>
              <span className={styles.footerLabel}>Prototype Scope</span>
              <span className={styles.footerText}>
                Local-first menu hub designed for consistent desktop scaling while preserving mobile fallback.
              </span>
            </div>
            <div className={styles.footerBlock}>
              <span className={styles.footerLabel}>Version</span>
              <span className={styles.footerText}>v0.1.0 · Phase 0 · Viktor Crumb&apos;s Domain</span>
            </div>
            <a href="../../" className={styles.backLink}>Back to site</a>
          </footer>
        </div>
      </div>
    </div>
  );
}
