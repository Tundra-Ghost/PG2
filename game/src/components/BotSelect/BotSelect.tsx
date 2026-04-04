import styles from './BotSelect.module.css';

export type BotId = 'chick' | 'pigeon' | 'magnus';

interface BotSelectProps {
  onSelect: (botId: BotId) => void;
  onBack: () => void;
  subtitle?: string;
}

export const BOTS: {
  id: BotId;
  icon: string;
  name: string;
  tagline: string;
  description: string;
  difficulty: number;
  available: boolean;
}[] = [
  {
    id: 'chick',
    icon: '🐣',
    name: 'Chick',
    tagline: 'Depth-1 · Material Evaluation',
    description: 'Grabs whatever looks tastiest. No plans. No remorse. Perfect for testing modifiers.',
    difficulty: 1,
    available: true,
  },
  {
    id: 'pigeon',
    icon: '🐦',
    name: 'Pigeon',
    tagline: 'Depth-3 · Positional Heuristics',
    description: 'Knows when to strut and when to scatter. Reads the board two moves ahead.',
    difficulty: 2,
    available: false,
  },
  {
    id: 'magnus',
    icon: '🦅',
    name: 'Magnus Jr.',
    tagline: 'Deep Search · Endgame Tables',
    description:
      'Modelled after a grandmaster pigeon that escaped a Swiss tournament in 2019. Undefeated.',
    difficulty: 3,
    available: false,
  },
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
  subtitle = 'Quick Play · Standard chess · No modifiers',
}: BotSelectProps) {
  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div className={styles.content}>
          <header className={styles.header}>
            <button className={styles.backBtn} onClick={onBack}>← Back</button>
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
                  onClick={() => bot.available && onSelect(bot.id)}
                  disabled={!bot.available}
                  aria-disabled={!bot.available}
                >
                  <span className={styles.cardIcon} aria-hidden="true">{bot.icon}</span>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardName}>{bot.name}</span>
                      <DifficultyPips level={bot.difficulty} />
                    </div>
                    <span className={styles.cardTagline}>{bot.tagline}</span>
                    <span className={styles.cardDesc}>{bot.description}</span>
                  </div>

                  {bot.available ? (
                    <span className={styles.cardPlay} aria-hidden="true">▶</span>
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
