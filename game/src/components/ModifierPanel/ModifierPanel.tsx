import { useEffect, useState } from 'react';
import type { Color, GameState, ModifierInstance } from '../../engine/types';
import {
  ALL_MODIFIERS,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  type ModifierCategory,
} from '../../modifiers/data';
import {
  getModifierDisplayBucket,
  getModifierOwnershipLabel,
} from '../../modifiers/presentation';
import { playClick } from '../../sound';
import styles from './ModifierPanel.module.css';

interface ModifierPanelProps {
  state: GameState;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  playerLabel?: string;
  opponentLabel?: string;
}

interface ModifierDisplay extends ModifierInstance {
  category?: ModifierCategory;
  categoryName?: string;
  color?: string;
  description?: string;
  typeLine?: string;
}

const modifierMeta = new Map(
  ALL_MODIFIERS.map(mod => [
    mod.id,
    {
      category: mod.category,
      categoryName: CATEGORY_NAMES[mod.category],
      color: CATEGORY_COLORS[mod.category],
      description: mod.description,
      typeLine: mod.typeLine,
    },
  ]),
);

const CATEGORY_LABELS: Record<ModifierCategory, string> = {
  A: 'Board',
  B: 'Curse',
  C: 'Ability',
  D: 'Fog',
  E: 'Army',
};

function modKey(mod: ModifierDisplay): string {
  return `${mod.id}-${mod.sourceColor ?? 'both'}-${mod.activeFor}`;
}

function bucketModifiers(
  modifiers: ModifierInstance[],
): Record<Color | 'both', ModifierDisplay[]> {
  const buckets: Record<Color | 'both', ModifierDisplay[]> = {
    white: [],
    both: [],
    black: [],
  };

  for (const mod of modifiers) {
    const meta = modifierMeta.get(mod.id);
    const bucket = getModifierDisplayBucket(mod);
    buckets[bucket].push({
      ...mod,
      category: meta?.category,
      categoryName: meta?.categoryName,
      color: meta?.color,
      description: meta?.description,
      typeLine: meta?.typeLine,
    });
  }

  for (const key of Object.keys(buckets) as Array<Color | 'both'>) {
    buckets[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return buckets;
}

function CategoryBadge({ mod }: { mod: ModifierDisplay }) {
  if (!mod.category) return null;
  return (
    <div className={styles.categoryBadgeWrap}>
      <span
        className={styles.categoryTag}
        style={{
          color: mod.color,
          borderColor: `${mod.color}66`,
          background: `${mod.color}14`,
        }}
      >
        {mod.category}
      </span>
      <span className={styles.categoryLabel}>{CATEGORY_LABELS[mod.category]}</span>
    </div>
  );
}

function CompactCard({
  mod,
  onExpand,
}: {
  mod: ModifierDisplay;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.modCard}
      style={mod.color ? ({ '--accent-color': mod.color } as React.CSSProperties) : undefined}
      onClick={() => {
        playClick();
        onExpand();
      }}
      title="Click to expand"
    >
      <div className={styles.modTopRow}>
        <div className={styles.modTitleBlock}>
          <span className={styles.modName}>{mod.name}</span>
          {mod.typeLine && <span className={styles.typeLine}>{mod.typeLine}</span>}
        </div>
        <CategoryBadge mod={mod} />
      </div>
    </button>
  );
}

function ExpandedCard({
  mod,
  onCollapse,
}: {
  mod: ModifierDisplay;
  onCollapse: () => void;
}) {
  return (
    <div
      className={styles.expandedCard}
      style={mod.color ? ({ '--accent-color': mod.color } as React.CSSProperties) : undefined}
    >
      <div className={styles.expandedTopBar}>
        <div className={styles.expandedTitleBlock}>
          <span className={styles.modName}>{mod.name}</span>
          {mod.typeLine && <span className={styles.typeLine}>{mod.typeLine}</span>}
        </div>
        <div className={styles.expandedBadgeClose}>
          <CategoryBadge mod={mod} />
          <button
            type="button"
            className={styles.collapseCardBtn}
            onClick={() => {
              playClick();
              onCollapse();
            }}
            aria-label="Collapse modifier"
          >
            ✕
          </button>
        </div>
      </div>

      {mod.description && (
        <p className={styles.expandedDescription}>{mod.description}</p>
      )}

      <div className={styles.modMeta}>
        <span className={styles.modId}>{mod.id}</span>
        <span className={styles.dot}>•</span>
        <span>{mod.categoryName ?? 'Unclassified'}</span>
        {(mod.sourceColor || mod.activeFor === 'both') && (
          <>
            <span className={styles.dot}>•</span>
            <span>{getModifierOwnershipLabel(mod)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function SectionCompact({
  title,
  mods,
  emptyLabel,
  onExpand,
}: {
  title: string;
  mods: ModifierDisplay[];
  emptyLabel: string;
  onExpand: (key: string) => void;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionCount}>{mods.length}</span>
      </header>

      {mods.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <div className={styles.modList}>
          {mods.map(mod => (
            <CompactCard
              key={modKey(mod)}
              mod={mod}
              onExpand={() => onExpand(modKey(mod))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ModifierPanel({
  state,
  collapsed = false,
  onToggleCollapsed,
  playerLabel = 'Your Draft',
  opponentLabel = 'Opponent Draft',
}: ModifierPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Reset accordion when panel collapses
  useEffect(() => {
    if (collapsed) setExpandedKey(null);
  }, [collapsed]);

  const buckets = bucketModifiers(state.activeModifiers);
  const total = state.activeModifiers.length;
  const ownedCount = buckets.white.length;
  const sharedCount = buckets.both.length;
  const opponentCount = buckets.black.length;

  const allMods = [...buckets.white, ...buckets.both, ...buckets.black];
  const expandedMod = expandedKey ? (allMods.find(m => modKey(m) === expandedKey) ?? null) : null;

  const sections = [
    { title: playerLabel, mods: buckets.white, emptyLabel: 'No player-owned modifiers.' },
    { title: 'Shared Effects', mods: buckets.both, emptyLabel: 'No shared modifiers.' },
    { title: opponentLabel, mods: buckets.black, emptyLabel: 'No opponent-owned modifiers.' },
  ];

  return (
    <aside
      className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.headerTitle}>Active Modifiers</span>
          {!collapsed && (
            <span className={styles.headerSub}>
              {total > 0
                ? `${ownedCount} yours · ${sharedCount} shared · ${opponentCount} theirs`
                : 'Standard rules'}
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => {
            playClick();
            onToggleCollapsed?.();
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand modifier panel' : 'Collapse modifier panel'}
        >
          {collapsed ? '←' : '→'}
        </button>
      </header>

      {collapsed ? (
        <div className={styles.collapsedBody}>
          <span className={styles.collapsedCount}>{total}</span>
          <span className={styles.collapsedLabel}>mods</span>
          {total > 0 && (
            <div className={styles.collapsedBreakdown}>
              <span className={styles.collapsedBreakdownLine}>Y {ownedCount}</span>
              <span className={styles.collapsedBreakdownLine}>S {sharedCount}</span>
              <span className={styles.collapsedBreakdownLine}>T {opponentCount}</span>
            </div>
          )}
        </div>
      ) : expandedMod ? (
        <div className={`${styles.body} ${styles.bodyExpanded}`}>
          <ExpandedCard mod={expandedMod} onCollapse={() => setExpandedKey(null)} />
        </div>
      ) : (
        <div className={styles.body}>
          {sections.map(section => (
            <SectionCompact
              key={section.title}
              title={section.title}
              mods={section.mods}
              emptyLabel={section.emptyLabel}
              onExpand={setExpandedKey}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
