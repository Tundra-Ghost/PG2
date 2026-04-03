import { useState, useMemo } from 'react';
import {
  ALL_MODIFIERS,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  type ModifierCard,
  type ModifierCategory,
} from '../../modifiers/data';
import styles from './DraftScreen.module.css';

// Story Mode budget per GDD: 8pt
const BUDGET = 8;
const MAX_COUNT = 5;
const MAX_PER_CATEGORY = 2;

interface DraftScreenProps {
  onStartMatch: (selectedIds: string[]) => void;
  onBack: () => void;
}

type CategoryFilter = 'ALL' | ModifierCategory;

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'A', label: 'A · Board' },
  { key: 'B', label: 'B · Cursed' },
  { key: 'C', label: 'C · Abilities' },
  { key: 'D', label: 'D · Fog' },
  { key: 'E', label: 'E · Army' },
];

function getCostDisplay(cost: number) {
  if (cost === 0) return '0 pts';
  if (cost > 0) return `+${cost} pts`;
  return `${cost} pts`; // negative shows its own minus sign
}

function CursePips({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <span className={styles.cursePips} aria-label={`Curse level ${level}`}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`${styles.pip} ${i < level ? styles.pipFilled : styles.pipEmpty}`}
        />
      ))}
    </span>
  );
}

export default function DraftScreen({ onStartMatch, onBack }: DraftScreenProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Selection math ──────────────────────────────────────────────────────────
  const selected = useMemo(
    () => ALL_MODIFIERS.filter(m => selectedIds.includes(m.id)),
    [selectedIds],
  );

  const totalCost = useMemo(
    () => selected.reduce((sum, m) => sum + m.cost, 0),
    [selected],
  );

  const remaining = BUDGET - totalCost;
  const overBudget = totalCost > BUDGET;

  function categoryCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of selected) {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    return counts;
  }

  function canSelect(mod: ModifierCard): boolean {
    if (selectedIds.includes(mod.id)) return true; // already selected → can deselect
    if (selected.length >= MAX_COUNT) return false;
    if (totalCost + mod.cost > BUDGET) return false;
    const counts = categoryCounts();
    if ((counts[mod.category] ?? 0) >= MAX_PER_CATEGORY) return false;
    return true;
  }

  function toggleMod(mod: ModifierCard) {
    if (selectedIds.includes(mod.id)) {
      setSelectedIds(prev => prev.filter(id => id !== mod.id));
    } else if (canSelect(mod)) {
      setSelectedIds(prev => [...prev, mod.id]);
    }
  }

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = ALL_MODIFIERS;
    if (activeCategory !== 'ALL') {
      list = list.filter(m => m.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        m =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.typeLine.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeCategory, query]);

  // ── Budget bar width ─────────────────────────────────────────────────────────
  const barPct = Math.min(100, Math.max(0, (totalCost / BUDGET) * 100));

  return (
    <div className={styles.root}>
      {/* ── Left: Modifier browser ──────────────────────────────────────────── */}
      <div className={styles.browser}>

        <header className={styles.browserHeader}>
          <div className={styles.browserTitle}>
            <h2 className={styles.heading}>Select Modifiers</h2>
            <span className={styles.headingSub}>New Run · Story Mode · 8pt budget</span>
          </div>

          {/* Search */}
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search modifiers…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search modifiers"
            />
            {query && (
              <button
                className={styles.searchClear}
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className={styles.chips} role="group" aria-label="Category filter">
            {CATEGORY_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                className={`${styles.chip} ${activeCategory === key ? styles.chipActive : ''}`}
                style={
                  activeCategory === key && key !== 'ALL'
                    ? {
                        borderColor: CATEGORY_COLORS[key as ModifierCategory],
                        color: CATEGORY_COLORS[key as ModifierCategory],
                        background: `${CATEGORY_COLORS[key as ModifierCategory]}18`,
                      }
                    : undefined
                }
                onClick={() => setActiveCategory(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Card grid */}
        <div className={styles.grid}>
          {filtered.length === 0 && (
            <p className={styles.empty}>No modifiers match your search.</p>
          )}
          {filtered.map(mod => {
            const isSelected = selectedIds.includes(mod.id);
            const selectable = canSelect(mod);
            const catColor = CATEGORY_COLORS[mod.category];
            const isExpanded = expandedId === mod.id;

            return (
              <div
                key={mod.id}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${!selectable && !isSelected ? styles.cardDisabled : ''}`}
                style={isSelected ? { '--cat-color': catColor } as React.CSSProperties : undefined}
                onClick={() => toggleMod(mod)}
              >
                {/* Category stripe */}
                <div
                  className={styles.cardStripe}
                  style={{ background: catColor }}
                />

                <div className={styles.cardBody}>
                  {/* Top row: ID + tier + cost */}
                  <div className={styles.cardMeta}>
                    <span className={styles.cardId}>{mod.id}</span>
                    <span
                      className={`${styles.tier} ${styles[`tier${mod.tier}`]}`}
                    >
                      {mod.tier}
                    </span>
                    <span
                      className={`${styles.cost} ${mod.cost < 0 ? styles.costNegative : mod.cost === 0 ? styles.costZero : ''}`}
                    >
                      {getCostDisplay(mod.cost)}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className={styles.cardName}>{mod.name}</h3>

                  {/* Type line */}
                  <p
                    className={styles.cardType}
                    style={{ color: catColor }}
                  >
                    {mod.typeLine}
                  </p>

                  {/* Description */}
                  <p className={styles.cardDesc}>{mod.description}</p>

                  {/* Flavor — toggle expanded */}
                  <button
                    className={styles.flavorToggle}
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : mod.id);
                    }}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Hide flavor ▲' : 'Flavor text ▼'}
                  </button>
                  {isExpanded && (
                    <p className={styles.cardFlavor}>{mod.flavor}</p>
                  )}

                  {/* Bottom row: category label + curse pips */}
                  <div className={styles.cardFooter}>
                    <span
                      className={styles.categoryLabel}
                      style={{ color: catColor }}
                    >
                      {CATEGORY_NAMES[mod.category]}
                    </span>
                    <CursePips level={mod.curseLevel} />
                  </div>
                </div>

                {/* Selected checkmark */}
                {isSelected && (
                  <div
                    className={styles.selectedBadge}
                    style={{ background: catColor }}
                  >
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Selection panel ──────────────────────────────────────────── */}
      <aside className={styles.panel}>
        <div className={styles.panelInner}>

          <h2 className={styles.panelHeading}>Build Summary</h2>

          {/* Budget bar */}
          <div className={styles.budgetSection}>
            <div className={styles.budgetRow}>
              <span className={styles.budgetLabel}>Budget</span>
              <span className={`${styles.budgetValue} ${overBudget ? styles.budgetOver : ''}`}>
                {totalCost} / {BUDGET} pts
              </span>
            </div>
            <div className={styles.budgetTrack}>
              <div
                className={`${styles.budgetFill} ${overBudget ? styles.budgetFillOver : ''}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            {remaining > 0 && (
              <p className={styles.budgetHint}>{remaining} pts remaining</p>
            )}
            {remaining === 0 && !overBudget && (
              <p className={styles.budgetHint}>Budget full</p>
            )}
            {overBudget && (
              <p className={`${styles.budgetHint} ${styles.budgetHintOver}`}>
                Over budget by {totalCost - BUDGET} pts
              </p>
            )}
          </div>

          {/* Count */}
          <div className={styles.countRow}>
            <span className={styles.countLabel}>Modifiers</span>
            <span className={styles.countValue}>
              {selected.length} / {MAX_COUNT}
            </span>
          </div>

          {/* Selected list */}
          <div className={styles.selectedList}>
            {selected.length === 0 && (
              <p className={styles.emptySelected}>
                No modifiers selected.
                <br />
                <span>Click a card to add it to your build.</span>
              </p>
            )}
            {selected.map(mod => (
              <div key={mod.id} className={styles.selectedItem}>
                <div
                  className={styles.selectedDot}
                  style={{ background: CATEGORY_COLORS[mod.category] }}
                />
                <span className={styles.selectedName}>{mod.name}</span>
                <span
                  className={`${styles.selectedCost} ${mod.cost < 0 ? styles.costNegative : ''}`}
                >
                  {getCostDisplay(mod.cost)}
                </span>
                <button
                  className={styles.removeBtn}
                  onClick={() => toggleMod(mod)}
                  aria-label={`Remove ${mod.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Constraints hint */}
          {selected.length > 0 && (
            <p className={styles.rulesHint}>
              Max {MAX_COUNT} modifiers · {MAX_PER_CATEGORY} per category
            </p>
          )}

          {/* Viktor quote */}
          <div className={styles.viktorQuote}>
            <p className={styles.viktorText}>
              {selected.length === 0
                ? '"An empty build is a statement of intent. Viktor chose not to explain the statement."'
                : selected.length >= MAX_COUNT
                ? '"The build is complete. Viktor is either very confident or completely wrong. Possibly both."'
                : '"Choose carefully. The board remembers every modifier. The pigeon does not. The pigeon chooses randomly."'}
            </p>
            <span className={styles.viktorAttr}>— Viktor Crumb</span>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={styles.startBtn}
              onClick={() => onStartMatch(selectedIds)}
              disabled={overBudget}
            >
              Start Match
            </button>
            <button className={styles.backBtn} onClick={onBack}>
              ← Back to Menu
            </button>
          </div>

        </div>
      </aside>
    </div>
  );
}
