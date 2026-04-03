import styles from './MainMenu.module.css';

interface MainMenuProps {
  onPlay: (mode: 'run' | 'quick') => void;
}

type MenuItem =
  | { type: 'active'; mode: 'run' | 'quick'; label: string; sub: string }
  | { type: 'locked'; label: string; sub: string; badge: string };

const MENU_ITEMS: MenuItem[] = [
  { type: 'active', mode: 'run',   label: 'New Run',    sub: 'Story Mode · Five Towers · Roguelike' },
  { type: 'active', mode: 'quick', label: 'Quick Play',  sub: 'Standard Chess · No Modifiers' },
  { type: 'locked',                label: 'VS Bots',     sub: 'Chick · Pigeon · Magnus',   badge: 'SOON' },
  { type: 'locked',                label: 'Ranked',      sub: 'ELO Ladder · Pick / Ban',   badge: 'SOON' },
  { type: 'locked',                label: 'Casual',      sub: 'Online · Open Modifier Pool', badge: 'SOON' },
];

const SECONDARY_ITEMS: MenuItem[] = [
  { type: 'locked', label: 'Modifier Vault',  sub: 'Browse all 40 modifiers · 5 categories', badge: 'SOON' },
  { type: 'locked', label: 'The Roost',       sub: 'Hall of Feathers · Run History',          badge: 'SOON' },
  { type: 'locked', label: 'Settings',        sub: 'Audio · Display · Controls',              badge: 'SOON' },
];

export default function MainMenu({ onPlay }: MainMenuProps) {
  return (
    <div className={styles.root}>

      {/* ── Scroll container ─────────────────────── */}
      <div className={styles.scroll}>
        <div className={styles.content}>

          {/* ── Logo / Hero ──────────────────────── */}
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

          {/* ── Viktor Crumb Quote ───────────────── */}
          <figure className={styles.quoteBlock}>
            <blockquote className={styles.quoteText}>
              "The board remembers nothing. The pigeon remembers everything."
            </blockquote>
            <figcaption className={styles.quoteAttr}>
              — Viktor Crumb &nbsp;·&nbsp; Match 1, Move 4
            </figcaption>
          </figure>

          {/* ── Primary Game Modes ───────────────── */}
          <nav className={styles.section} aria-label="Game modes">
            <p className={styles.sectionLabel}>Select Mode</p>
            <ul className={styles.menuList} role="list">
              {MENU_ITEMS.map((item) => (
                <li key={item.label}>
                  {item.type === 'active' ? (
                    <button
                      className={`${styles.menuItem} ${item.mode === 'run' ? styles.menuItemPrimary : ''}`}
                      onClick={() => onPlay(item.mode)}
                    >
                      <span className={styles.itemArrow} aria-hidden="true">▶</span>
                      <span className={styles.itemBody}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        <span className={styles.itemSub}>{item.sub}</span>
                      </span>
                    </button>
                  ) : (
                    <button className={`${styles.menuItem} ${styles.menuItemLocked}`} disabled>
                      <span className={styles.itemArrow} aria-hidden="true">◈</span>
                      <span className={styles.itemBody}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        <span className={styles.itemSub}>{item.sub}</span>
                      </span>
                      <span className={styles.badge}>{item.badge}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Secondary Links ──────────────────── */}
          <nav className={styles.section} aria-label="Collections and settings">
            <p className={styles.sectionLabel}>Collections &amp; Settings</p>
            <ul className={styles.menuList} role="list">
              {SECONDARY_ITEMS.map((item) => (
                <li key={item.label}>
                  <button className={`${styles.menuItem} ${styles.menuItemLocked} ${styles.menuItemSecondary}`} disabled>
                    <span className={styles.itemArrow} aria-hidden="true">◈</span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemLabel}>{item.label}</span>
                      <span className={styles.itemSub}>{item.sub}</span>
                    </span>
                    <span className={styles.badge}>{item.badge}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Footer ───────────────────────────── */}
          <footer className={styles.footer}>
            <a href="../../" className={styles.backLink}>← Back to site</a>
            <div className={styles.versionBlock}>
              <span className={styles.versionText}>v0.1.0</span>
              <span className={styles.versionDot}>·</span>
              <span className={styles.versionText}>Phase 0 — Foundation</span>
              <span className={styles.versionDot}>·</span>
              <span className={styles.versionText}>Viktor Crumb's Domain</span>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
