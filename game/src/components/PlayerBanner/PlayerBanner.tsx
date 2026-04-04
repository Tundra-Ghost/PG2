import styles from './PlayerBanner.module.css';

interface PlayerBannerProps {
  role: string;
  name: string;
  subtitle: string;
  badge?: string;
  portraitLabel?: string;
  align?: 'left' | 'right';
}

export default function PlayerBanner({
  role,
  name,
  subtitle,
  badge,
  portraitLabel,
  align = 'left',
}: PlayerBannerProps) {
  return (
    <section
      className={`${styles.card} ${align === 'right' ? styles.cardRight : ''}`}
      aria-label={`${role} banner`}
    >
      <div className={styles.portraitFrame} aria-hidden="true">
        <div className={styles.portrait}>{portraitLabel ?? role.slice(0, 1)}</div>
      </div>

      <div className={styles.content}>
        <div className={styles.topRow}>
          <span className={styles.role}>{role}</span>
          {badge ? <span className={styles.badge}>{badge}</span> : null}
        </div>
        <div className={styles.name}>{name}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
    </section>
  );
}
