import type { Color, GameState, ModifierInstance } from '../../engine/types';
import {
  ALL_MODIFIERS,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  type ModifierCategory,
} from '../../modifiers/data';
import styles from './ModifierPanel.module.css';

interface ModifierPanelProps {
  state: GameState;
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
    const bucket = mod.sourceColor ?? mod.activeFor;
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

function Section({
  title,
  mods,
  emptyLabel,
}: {
  title: string;
  mods: ModifierDisplay[];
  emptyLabel: string;
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
            <article
              key={`${mod.activeFor}-${mod.id}`}
              className={styles.modCard}
              style={
                mod.color
                  ? ({ '--accent-color': mod.color } as React.CSSProperties)
                  : undefined
              }
              title={mod.description}
            >
              <div className={styles.modTopRow}>
                <div className={styles.modTitleBlock}>
                  <span className={styles.modName}>{mod.name}</span>
                  {mod.typeLine && (
                    <span className={styles.typeLine}>{mod.typeLine}</span>
                  )}
                </div>
                {mod.category && (
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
                    <span className={styles.categoryLabel}>
                      {CATEGORY_LABELS[mod.category]}
                    </span>
                  </div>
                )}
              </div>

              {mod.description && (
                <p className={styles.description}>{mod.description}</p>
              )}

              <div className={styles.modMeta}>
                <span className={styles.modId}>{mod.id}</span>
                <span className={styles.dot}>•</span>
                <span>{mod.categoryName ?? 'Unclassified'}</span>
                {mod.sourceColor && (
                  <>
                    <span className={styles.dot}>•</span>
                    <span>{mod.sourceColor} owned</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ModifierPanel({ state }: ModifierPanelProps) {
  const buckets = bucketModifiers(state.activeModifiers);

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Active Modifiers</span>
        <span className={styles.headerSub}>
          {state.activeModifiers.length > 0
            ? `${state.activeModifiers.length} active`
            : 'Standard rules'}
        </span>
      </header>

      <div className={styles.body}>
        <Section
          title="White"
          mods={buckets.white}
          emptyLabel="No white-only modifiers."
        />
        <Section
          title="Shared"
          mods={buckets.both}
          emptyLabel="No shared modifiers."
        />
        <Section
          title="Black"
          mods={buckets.black}
          emptyLabel="No black-only modifiers."
        />
      </div>
    </aside>
  );
}
