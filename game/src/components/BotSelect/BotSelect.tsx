import { playClick } from '../../sound';
import { BOTS, type BotId } from '../../opponents';
import styles from './BotSelect.module.css';

interface BotSelectProps {
  onSelect: (botId: BotId) => void;
  onBack: () => void;
  subtitle?: string;
}

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
                    {bot.icon}
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
