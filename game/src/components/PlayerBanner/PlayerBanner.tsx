import styles from './PlayerBanner.module.css';

interface PlayerBannerProps {
  role: string;
  name: string;
  subtitle: string;
  badge?: string;
  portraitLabel?: string;
  portraitSrc?: string | null;
  metaLine?: string;
  align?: 'left' | 'right';
  onClick?: () => void;
}

export default function PlayerBanner({
  role,
  name,
  subtitle,
  badge,
  portraitLabel,
  portraitSrc,
  metaLine,
  align = 'left',
  onClick,
}: PlayerBannerProps) {
  const Tag = onClick ? 'button' : 'section';

  return (
    <Tag
      className={`${styles.card} ${align === 'right' ? styles.cardRight : ''} ${onClick ? styles.cardButton : ''}`}
      aria-label={`${role} banner`}
      onClick={onClick}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <div className={styles.portraitFrame} aria-hidden="true">
        {portraitSrc ? (
          <img src={portraitSrc} alt="" className={styles.portraitImage} />
        ) : (
          <div className={styles.portrait}>{portraitLabel ?? role.slice(0, 1)}</div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.topRow}>
          <span className={styles.role}>{role}</span>
          {badge ? <span className={styles.badge}>{badge}</span> : null}
        </div>
        <div className={styles.name}>{name}</div>
        {metaLine ? <div className={styles.metaLine}>{metaLine}</div> : null}
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
    </Tag>
  );
}
