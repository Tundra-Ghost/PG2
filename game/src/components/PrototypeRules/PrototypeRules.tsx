import styles from './PrototypeRules.module.css';

interface PrototypeRulesProps {
  text?: string;
  /** dark = draft and vault cards; light = parchment in-match panel. */
  tone?: 'dark' | 'light';
}

/** "In this build" note: how a modifier really plays today. */
export default function PrototypeRules({ text, tone = 'dark' }: PrototypeRulesProps) {
  if (!text) return null;
  return (
    <div className={`${styles.box} ${tone === 'light' ? styles.light : styles.dark}`}>
      <span className={styles.label}>In this build</span>
      <p className={styles.text}>{text}</p>
    </div>
  );
}
