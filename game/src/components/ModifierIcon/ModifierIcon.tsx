import type { CSSProperties } from 'react';
import type { ModifierCategory } from '@pigeon-chess/game-core';
import { ALL_MODIFIERS } from '@pigeon-chess/game-core';
import styles from './ModifierIcon.module.css';

// One 48x48 SVG per modifier, drawn in currentColor so the category
// colour comes from CSS. Files live in assets/modifier-icons.
const files = import.meta.glob('../../assets/modifier-icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ICONS = new Map(
  Object.entries(files).map(([path, svg]) => [path.slice(path.lastIndexOf('/') + 1, -4), svg]),
);

const CATEGORY_BY_ID = new Map(ALL_MODIFIERS.map(card => [card.id, card.category]));

export function hasModifierIcon(id: string): boolean {
  return ICONS.has(id);
}

function getSvg(key: string): string | undefined {
  return ICONS.get(key);
}

interface IconProps {
  size?: number | string;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

function Icon({ svg, size = 24, className, title, style }: IconProps & { svg: string | undefined }) {
  if (!svg) return null;
  return (
    <span
      className={`${styles.icon} ${className ?? ''}`}
      style={{ width: size, height: size, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** A modifier's icon. Falls back to its category mark if it has none yet. */
export function ModifierIcon({ id, ...rest }: IconProps & { id: string }) {
  const category = CATEGORY_BY_ID.get(id);
  return <Icon svg={getSvg(id) ?? (category && getSvg(`category-${category}`))} {...rest} />;
}

export function CategoryIcon({ category, ...rest }: IconProps & { category: ModifierCategory }) {
  return <Icon svg={getSvg(`category-${category}`)} {...rest} />;
}
