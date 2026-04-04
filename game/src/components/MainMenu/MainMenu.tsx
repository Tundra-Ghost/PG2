import styles from './MainMenu.module.css';

interface MainMenuProps {
  onPlay: (mode: 'run' | 'quick') => void;
  onSettings: () => void;
}

export default function MainMenu({ onPlay, onSettings }: MainMenuProps) {
  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div className={styles.content}>
          <header className={styles.hero}>
            <div className={styles.pigeonWrap}>
              <span className={styles.pigeonIcon} aria-hidden="true">🐦</span>
            </div>
            <h1 className={styles.title}>Pigeon Chess</h1>
            <p className={styles.tagLine}>
              <span className={styles.tagDash} />
              <span className={styles.tagText}>A Roguelike Chess Experience</span>
              <span className={styles.tagDash} />
            </p>
          </header>

          <figure className={styles.quoteBlock}>
            <blockquote className={styles.quoteText}>
              "The board remembers nothing. The pigeon remembers everything."
            </blockquote>
            <figcaption className={styles.quoteAttr}>- Viktor Crumb · Match 1, Move 4</figcaption>
          </figure>

          <section className={styles.liveCard} aria-label="Current build status">
            <div className={styles.liveHeader}>
              <span className={styles.liveLabel}>Current Slice</span>
              <span className={styles.liveBadge}>Phase 0</span>
            </div>
            <p className={styles.liveText}>
              Local prototype with draftable modifiers, one bot path, and the shipped modifier set wired for testing.
            </p>
            <div className={styles.liveStats}>
              <span className={styles.liveStat}>New Run</span>
              <span className={styles.liveStat}>Quick Play</span>
              <span className={styles.liveStat}>5 live mods</span>
            </div>
          </section>

          <nav className={styles.section} aria-label="Play modes">
            <div className={styles.sectionTop}>
              <p className={styles.sectionLabel}>Play</p>
              <span className={styles.sectionNote}>Live now</span>
            </div>

            <button
              className={`${styles.menuItem} ${styles.menuItemPrimary}`}
              onClick={() => onPlay('run')}
            >
              <span className={styles.itemArrow} aria-hidden="true">▶</span>
              <span className={styles.itemBody}>
                <span className={styles.itemLabel}>New Run</span>
                <span className={styles.itemSub}>Story Mode · Five Towers · Modifier Draft</span>
              </span>
            </button>

            <button className={styles.menuItem} onClick={() => onPlay('quick')}>
              <span className={styles.itemArrow} aria-hidden="true">▶</span>
              <span className={styles.itemBody}>
                <span className={styles.itemLabel}>Quick Play</span>
                <span className={styles.itemSub}>Standard chess · No modifiers · No draft</span>
              </span>
            </button>
          </nav>

          <nav className={styles.section} aria-label="Online modes">
            <div className={styles.sectionTop}>
              <p className={styles.sectionLabel}>Online</p>
              <span className={styles.sectionNote}>Roadmap</span>
            </div>

            {[
              { label: 'VS Bots', sub: 'Chick · Pigeon · Magnus difficulty' },
              { label: 'Ranked', sub: 'ELO ladder · Modifier pick / ban' },
              { label: 'Casual', sub: 'Open lobby · Open modifier pool' },
            ].map(({ label, sub }) => (
              <button
                key={label}
                className={`${styles.menuItem} ${styles.menuItemLocked}`}
                disabled
              >
                <span className={styles.itemArrow} aria-hidden="true">◆</span>
                <span className={styles.itemBody}>
                  <span className={styles.itemLabel}>{label}</span>
                  <span className={styles.itemSub}>{sub}</span>
                </span>
                <span className={styles.badge}>SOON</span>
              </button>
            ))}
          </nav>

          <nav className={styles.section} aria-label="Collections">
            <div className={styles.sectionTop}>
              <p className={styles.sectionLabel}>Explore</p>
              <span className={styles.sectionNote}>Tools</span>
            </div>

            {[
              { label: 'Modifier Vault', sub: '40 modifiers · 5 categories · Full Bible' },
              { label: 'The Roost', sub: 'Run history · Hall of Feathers · Stats' },
            ].map(({ label, sub }) => (
              <button
                key={label}
                className={`${styles.menuItem} ${styles.menuItemLocked} ${styles.menuItemSmall}`}
                disabled
              >
                <span className={styles.itemArrow} aria-hidden="true">◆</span>
                <span className={styles.itemBody}>
                  <span className={styles.itemLabel}>{label}</span>
                  <span className={styles.itemSub}>{sub}</span>
                </span>
                <span className={styles.badge}>SOON</span>
              </button>
            ))}

            <button
              className={`${styles.menuItem} ${styles.menuItemSmall}`}
              onClick={onSettings}
            >
              <span className={styles.itemArrow} aria-hidden="true">▶</span>
              <span className={styles.itemBody}>
                <span className={styles.itemLabel}>Settings</span>
                <span className={styles.itemSub}>Audio · Display · Gameplay · Accessibility</span>
              </span>
            </button>
          </nav>

          <footer className={styles.footer}>
            <a href="../../" className={styles.backLink}>← Back to site</a>
            <div className={styles.versionBlock}>
              <span className={styles.versionText}>v0.1.0</span>
              <span className={styles.versionDot}>·</span>
              <span className={styles.versionText}>Phase 0</span>
              <span className={styles.versionDot}>·</span>
              <span className={styles.versionText}>Viktor Crumb&apos;s Domain</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
