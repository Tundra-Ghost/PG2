import { playClick } from '../../sound';
import { BOTS, type BotId } from '../../opponents';
import styles from './BotSelect.module.css';

export type BotMatchMode = 'run' | 'quick' | 'practice';

interface BotSelectProps {
  onSelect: (botId: BotId) => void;
  onBack: () => void;
  subtitle?: string;
  /** With onModeChange, shows a Modifier draft / Standard chess switch. */
  mode?: BotMatchMode;
  onModeChange?: (mode: BotMatchMode) => void;
}

const MODES: { mode: BotMatchMode; label: string }[] = [
  { mode: 'run', label: 'Modifier draft' },
  { mode: 'quick', label: 'Standard chess' },
  { mode: 'practice', label: 'Practice' },
];

function DifficultyPips({ level, max = 3 }: { level: number; max?: number }) {
  return (
    <div className={styles.pips} aria-label={`Difficulty ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`${styles.pip} ${i < level ? styles.pipFilled : ''}`} />
      ))}
    </div>
  );
}

export default function BotSelect({
  onSelect,
  onBack,
  subtitle = 'Quick Play - Standard chess - No modifiers',
  mode,
  onModeChange,
}: BotSelectProps) {
  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div className={styles.content}>
          <header className={styles.header}>
            <button
              className={styles.backBtn}
              onClick={() => {
                playClick();
                onBack();
              }}
            >
              {'<- Back'}
            </button>
            <div className={styles.heading}>
              <h2 className={styles.title}>Choose Opponent</h2>
              <p className={styles.sub}>{subtitle}</p>
            </div>
          </header>

          {mode && onModeChange && (
            <div className={styles.modeRow} role="radiogroup" aria-label="Game type">
              {MODES.map(option => (
                <button
                  key={option.mode}
                  role="radio"
                  aria-checked={mode === option.mode}
                  className={`${styles.modeBtn} ${mode === option.mode ? styles.modeOn : ''}`}
                  onClick={() => {
                    playClick();
                    onModeChange(option.mode);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <ul className={styles.list} role="list">
            {BOTS.map(bot => (
              <li key={bot.id}>
                <button
                  className={`${styles.card} ${!bot.available ? styles.cardLocked : ''}`}
                  onClick={() => {
                    if (!bot.available) return;
                    playClick();
                    onSelect(bot.id as BotId);
                  }}
                  disabled={!bot.available}
                  aria-disabled={!bot.available}
                >
                  <span className={styles.cardIcon} aria-hidden="true">
                    {bot.sprite ? <img src={bot.sprite} alt="" className={styles.cardSprite} /> : bot.icon}
                  </span>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardName}>{bot.name}</span>
                      <DifficultyPips level={bot.difficulty} />
                    </div>
                    <span className={styles.cardTagline}>{bot.tagline}</span>
                    <span className={styles.cardDesc}>{bot.description}</span>
                  </div>

                  {bot.available ? (
                    <span className={styles.cardPlay} aria-hidden="true">
                      {'>'}
                    </span>
                  ) : (
                    <span className={styles.badge}>SOON</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
