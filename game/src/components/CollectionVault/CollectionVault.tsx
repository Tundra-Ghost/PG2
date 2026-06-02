import { useMemo, useState } from 'react';
import {
  ALL_MODIFIERS,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  type ModifierCard,
  type ModifierCategory,
} from '../../modifiers/data';
import { modifierRegistry } from '../../modifiers/registry';
import { playClick } from '../../sound';
import '../../modifiers/index';
import styles from './CollectionVault.module.css';

type CategoryFilter = 'ALL' | ModifierCategory;
type StatusFilter = 'all' | 'implemented' | 'design';

interface CollectionVaultProps {
  onBack: () => void;
}

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'A', label: 'Board' },
  { key: 'B', label: 'Cursed' },
  { key: 'C', label: 'Abilities' },
  { key: 'D', label: 'Fog' },
  { key: 'E', label: 'Army' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All cards' },
  { key: 'implemented', label: 'Playable' },
  { key: 'design', label: 'Design only' },
];

function getCostLabel(cost: number): string {
  if (cost > 0) return `+${cost}`;
  return String(cost);
}

function getCurseLabel(level: number): string {
  if (level === 0) return 'No curse';
  return `Curse ${level}`;
}

function VaultCard({
  card,
  implemented,
  expanded,
  onToggle,
}: {
  card: ModifierCard;
  implemented: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = CATEGORY_COLORS[card.category];

  return (
    <article
      className={`${styles.card} ${implemented ? styles.cardImplemented : styles.cardDesign}`}
      style={{ '--category-color': color } as React.CSSProperties}
    >
      <div className={styles.cardStripe} />
      <header className={styles.cardHeader}>
        <span className={styles.cardId}>{card.id}</span>
        <span className={implemented ? styles.statusLive : styles.statusDesign}>
          {implemented ? 'Playable' : 'Design'}
        </span>
      </header>

      <h3 className={styles.cardName}>{card.name}</h3>
      <p className={styles.typeLine}>{card.typeLine}</p>

      <dl className={styles.metaGrid}>
        <div>
          <dt>Cost</dt>
          <dd className={card.cost < 0 ? styles.negativeCost : ''}>{getCostLabel(card.cost)}</dd>
        </div>
        <div>
          <dt>Tier</dt>
          <dd>{card.tier}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{getCurseLabel(card.curseLevel)}</dd>
        </div>
      </dl>

      <p className={styles.description}>{card.description}</p>

      <button
        type="button"
        className={styles.flavorButton}
        onClick={() => {
          playClick();
          onToggle();
        }}
        aria-expanded={expanded}
      >
        {expanded ? 'Hide flavor' : 'Show flavor'}
      </button>

      {expanded && <p className={styles.flavor}>{card.flavor}</p>}
    </article>
  );
}

export default function CollectionVault({ onBack }: CollectionVaultProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const implementedIds = useMemo(() => new Set(modifierRegistry.getAll().map(mod => mod.id)), []);

  const implementedCount = implementedIds.size;
  const designCount = ALL_MODIFIERS.length - implementedCount;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return ALL_MODIFIERS.filter(card => {
      const implemented = implementedIds.has(card.id);
      if (category !== 'ALL' && card.category !== category) return false;
      if (status === 'implemented' && !implemented) return false;
      if (status === 'design' && implemented) return false;
      if (!needle) return true;

      return (
        card.id.toLowerCase().includes(needle) ||
        card.name.toLowerCase().includes(needle) ||
        card.typeLine.toLowerCase().includes(needle) ||
        card.categoryName.toLowerCase().includes(needle) ||
        card.description.toLowerCase().includes(needle) ||
        card.flavor.toLowerCase().includes(needle)
      );
    });
  }, [category, implementedIds, query, status]);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => {
            playClick();
            onBack();
          }}
        >
          Back
        </button>

        <div className={styles.titleBlock}>
          <span className={styles.kicker}>Collection</span>
          <h1 className={styles.title}>Modifier Vault</h1>
          <p className={styles.subtitle}>
            Read-only bible for the prototype modifiers, including playable status and design-only
            cards.
          </p>
        </div>

        <dl className={styles.summary}>
          <div>
            <dt>Playable</dt>
            <dd>{implementedCount}</dd>
          </div>
          <div>
            <dt>Design</dt>
            <dd>{designCount}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{ALL_MODIFIERS.length}</dd>
          </div>
        </dl>
      </header>

      <section className={styles.controls} aria-label="Vault filters">
        <label className={styles.searchWrap}>
          <span>Search</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Name, id, type, category..."
          />
        </label>

        <div className={styles.filterGroup} role="group" aria-label="Category filter">
          {CATEGORY_FILTERS.map(item => (
            <button
              key={item.key}
              type="button"
              className={`${styles.filterButton} ${category === item.key ? styles.filterActive : ''}`}
              style={
                item.key !== 'ALL'
                  ? ({ '--filter-color': CATEGORY_COLORS[item.key] } as React.CSSProperties)
                  : undefined
              }
              onClick={() => {
                playClick();
                setCategory(item.key);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.filterGroup} role="group" aria-label="Implementation filter">
          {STATUS_FILTERS.map(item => (
            <button
              key={item.key}
              type="button"
              className={`${styles.filterButton} ${status === item.key ? styles.filterActive : ''}`}
              onClick={() => {
                playClick();
                setStatus(item.key);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <main className={styles.content}>
        <aside className={styles.categoryRail} aria-label="Modifier categories">
          {(Object.keys(CATEGORY_NAMES) as ModifierCategory[]).map(key => {
            const total = ALL_MODIFIERS.filter(card => card.category === key).length;
            const playable = ALL_MODIFIERS.filter(
              card => card.category === key && implementedIds.has(card.id),
            ).length;
            return (
              <button
                key={key}
                type="button"
                className={`${styles.categoryCard} ${category === key ? styles.categoryActive : ''}`}
                style={{ '--category-color': CATEGORY_COLORS[key] } as React.CSSProperties}
                onClick={() => {
                  playClick();
                  setCategory(key);
                }}
              >
                <span className={styles.categoryLetter}>{key}</span>
                <span className={styles.categoryName}>{CATEGORY_NAMES[key]}</span>
                <span className={styles.categoryMeta}>
                  {playable}/{total} playable
                </span>
              </button>
            );
          })}
        </aside>

        <section className={styles.gridWrap} aria-label="Modifier cards">
          <div className={styles.resultLine}>
            <span>{filtered.length} cards shown</span>
            <span>{status === 'all' ? 'Playable and design cards' : status}</span>
          </div>

          {filtered.length === 0 ? (
            <p className={styles.empty}>No modifiers match this filter.</p>
          ) : (
            <div className={styles.grid}>
              {filtered.map(card => (
                <VaultCard
                  key={card.id}
                  card={card}
                  implemented={implementedIds.has(card.id)}
                  expanded={expandedId === card.id}
                  onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
