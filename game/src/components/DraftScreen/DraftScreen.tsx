import { useEffect, useMemo, useState } from 'react';
import {
  ALL_MODIFIERS,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  type ModifierCard,
  type ModifierCategory,
} from '../../modifiers/data';
import { modifierRegistry } from '../../modifiers/registry';
import { isSharedDraftModifier } from '../../modifiers/scope';
import { playClick } from '../../sound';
import '../../modifiers/index';
import styles from './DraftScreen.module.css';

const BUDGET = 8;
const MAX_COUNT = 5;
const MAX_PER_CATEGORY = 2;

interface DraftScreenProps {
  onStartMatch: (playerSelectedIds: string[], opponentSelectedIds: string[]) => void;
  onBack: () => void;
  opponentName?: string;
  opponentModifierIds?: string[];
}

type CategoryFilter = 'ALL' | ModifierCategory;
type DraftTurn = 'player' | 'opponent' | 'done';

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'A', label: 'A - Board' },
  { key: 'B', label: 'B - Cursed' },
  { key: 'C', label: 'C - Abilities' },
  { key: 'D', label: 'D - Fog' },
  { key: 'E', label: 'E - Army' },
];

function getCostDisplay(cost: number) {
  if (cost === 0) return '0 pts';
  if (cost > 0) return `+${cost} pts`;
  return `${cost} pts`;
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

function getSelectedCards(ids: string[]) {
  return ALL_MODIFIERS.filter(mod => ids.includes(mod.id));
}

function getCategoryCounts(cards: ModifierCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    counts[card.category] = (counts[card.category] ?? 0) + 1;
  }
  return counts;
}

function getValidOptions(
  ownIds: string[],
  otherIds: string[],
  implementedIds: Set<string>,
): ModifierCard[] {
  const ownCards = getSelectedCards(ownIds);
  const ownCounts = getCategoryCounts(ownCards);
  const totalCost = ownCards.reduce((sum, card) => sum + card.cost, 0);

  return ALL_MODIFIERS.filter(card => {
    if (!implementedIds.has(card.id)) return false;
    if (ownIds.includes(card.id)) return false;
    if (isSharedDraftModifier(card.id) && otherIds.includes(card.id)) return false;
    if (ownCards.length >= MAX_COUNT) return false;
    if (totalCost + card.cost > BUDGET) return false;
    if ((ownCounts[card.category] ?? 0) >= MAX_PER_CATEGORY) return false;
    return true;
  });
}

function pickRandomCard(cards: ModifierCard[]): ModifierCard | null {
  if (cards.length === 0) return null;
  return cards[Math.floor(Math.random() * cards.length)] ?? null;
}

export default function DraftScreen({
  onStartMatch,
  onBack,
  opponentName = 'Opponent',
  opponentModifierIds = [],
}: DraftScreenProps) {
  const [playerSelectedIds, setPlayerSelectedIds] = useState<string[]>([]);
  const [botSelectedIds, setBotSelectedIds] = useState<string[]>(opponentModifierIds);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(true);
  const [draftTurn, setDraftTurn] = useState<DraftTurn>('player');
  const implementedIds = useMemo(() => new Set(modifierRegistry.getAll().map(mod => mod.id)), []);

  const playerSelected = useMemo(() => getSelectedCards(playerSelectedIds), [playerSelectedIds]);
  const botSelected = useMemo(() => getSelectedCards(botSelectedIds), [botSelectedIds]);

  const playerTotalCost = useMemo(
    () => playerSelected.reduce((sum, card) => sum + card.cost, 0),
    [playerSelected],
  );

  const remaining = BUDGET - playerTotalCost;
  const playerValidOptions = useMemo(
    () => getValidOptions(playerSelectedIds, botSelectedIds, implementedIds),
    [playerSelectedIds, botSelectedIds, implementedIds],
  );
  const botValidOptions = useMemo(
    () => getValidOptions(botSelectedIds, playerSelectedIds, implementedIds),
    [botSelectedIds, playerSelectedIds, implementedIds],
  );
  const draftFinished = draftTurn === 'done';

  useEffect(() => {
    if (draftTurn !== 'opponent') return;

    const timer = setTimeout(() => {
      const botPick = pickRandomCard(botValidOptions);
      const nextBotIds = botPick ? [...botSelectedIds, botPick.id] : botSelectedIds;
      if (botPick) {
        setBotSelectedIds(nextBotIds);
      }

      const nextPlayerOptions = getValidOptions(playerSelectedIds, nextBotIds, implementedIds);
      const nextBotOptions = getValidOptions(nextBotIds, playerSelectedIds, implementedIds);

      if (nextPlayerOptions.length === 0 && nextBotOptions.length === 0) {
        setDraftTurn('done');
      } else {
        setDraftTurn('player');
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [draftTurn, botValidOptions, botSelectedIds, implementedIds, playerSelectedIds]);

  useEffect(() => {
    if (draftTurn !== 'player') return;
    if (playerValidOptions.length > 0) return;

    if (botValidOptions.length > 0) {
      setDraftTurn('opponent');
    } else {
      setDraftTurn('done');
    }
  }, [draftTurn, playerValidOptions, botValidOptions]);

  const filtered = useMemo(() => {
    let list = ALL_MODIFIERS;
    if (hideUnavailable) {
      list = list.filter(card => implementedIds.has(card.id));
    }
    if (activeCategory !== 'ALL') {
      list = list.filter(card => card.category === activeCategory);
    }
    if (query.trim()) {
      const needle = query.toLowerCase();
      list = list.filter(
        card =>
          card.name.toLowerCase().includes(needle) ||
          card.id.toLowerCase().includes(needle) ||
          card.typeLine.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [activeCategory, hideUnavailable, implementedIds, query]);

  const barPct = Math.min(100, Math.max(0, (playerTotalCost / BUDGET) * 100));

  function isCardSelectable(card: ModifierCard): boolean {
    if (draftTurn !== 'player') return false;
    return playerValidOptions.some(option => option.id === card.id);
  }

  function handlePlayerPick(card: ModifierCard) {
    if (!isCardSelectable(card)) return;

    const nextPlayerIds = [...playerSelectedIds, card.id];
    const nextBotOptions = getValidOptions(botSelectedIds, nextPlayerIds, implementedIds);
    setPlayerSelectedIds(nextPlayerIds);

    if (nextBotOptions.length === 0) {
      const nextPlayerOptions = getValidOptions(nextPlayerIds, botSelectedIds, implementedIds);
      setDraftTurn(nextPlayerOptions.length === 0 ? 'done' : 'player');
      return;
    }

    setDraftTurn('opponent');
  }

  function handleFinishDraft() {
    playClick();
    onStartMatch(playerSelectedIds, botSelectedIds);
  }

  function getStatusCopy(): string {
    if (draftTurn === 'done') {
      return 'Draft complete. Start when ready.';
    }
    if (draftTurn === 'opponent') {
      return `${opponentName} is making a pick.`;
    }
    if (playerValidOptions.length === 0) {
      return 'No valid picks remain for you.';
    }
    return 'Your pick. Draft one modifier, then the opponent responds.';
  }

  return (
    <div className={styles.root}>
      <div className={styles.browser}>
        <header className={styles.browserHeader}>
          <div className={styles.browserTitle}>
            <h2 className={styles.heading}>Select Modifiers</h2>
            <span className={styles.headingSub}>Alternating draft - 8pt budget</span>
            <span className={styles.turnPill}>{getStatusCopy()}</span>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              ?
            </span>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search modifiers..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search modifiers"
            />
            {query && (
              <button
                className={styles.searchClear}
                onClick={() => {
                  playClick();
                  setQuery('');
                }}
                aria-label="Clear search"
              >
                x
              </button>
            )}
          </div>

          <label className={styles.filterToggle}>
            <input
              type="checkbox"
              checked={hideUnavailable}
              onChange={e => setHideUnavailable(e.target.checked)}
            />
            <span className={styles.filterToggleLabel}>Hide unavailable modifiers</span>
          </label>

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
                onClick={() => {
                  playClick();
                  setActiveCategory(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className={styles.grid}>
          {filtered.length === 0 && <p className={styles.empty}>No modifiers match your search.</p>}
          {filtered.map(card => {
            const selectable = isCardSelectable(card);
            const isImplemented = implementedIds.has(card.id);
            const selectedByPlayer = playerSelectedIds.includes(card.id);
            const selectedByOpponent = botSelectedIds.includes(card.id);
            const isSharedLocked = isSharedDraftModifier(card.id) && selectedByOpponent;
            const isExpanded = expandedId === card.id;
            const catColor = CATEGORY_COLORS[card.category];

            return (
              <div
                key={card.id}
                className={`${styles.card} ${
                  selectedByPlayer ? styles.cardSelected : ''
                } ${!selectable && !selectedByPlayer ? styles.cardDisabled : ''} ${
                  !isImplemented ? styles.cardUnimplemented : ''
                } ${isSharedLocked ? styles.cardClaimed : ''}`}
                style={
                  selectedByPlayer
                    ? ({ '--cat-color': catColor } as React.CSSProperties)
                    : undefined
                }
                onClick={() => handlePlayerPick(card)}
              >
                <div className={styles.cardStripe} style={{ background: catColor }} />

                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardId}>{card.id}</span>
                    {selectedByPlayer && <span className={styles.devBadge}>YOUR PICK</span>}
                    {selectedByOpponent && (
                      <span className={styles.devBadge}>{opponentName.toUpperCase()} PICK</span>
                    )}
                    {!isImplemented && <span className={styles.devBadge}>NOT IMPLEMENTED</span>}
                    <span className={`${styles.tier} ${styles[`tier${card.tier}`]}`}>
                      {card.tier}
                    </span>
                    <span
                      className={`${styles.cost} ${
                        card.cost < 0
                          ? styles.costNegative
                          : card.cost === 0
                            ? styles.costZero
                            : ''
                      }`}
                    >
                      {getCostDisplay(card.cost)}
                    </span>
                  </div>

                  <h3 className={styles.cardName}>{card.name}</h3>
                  <p className={styles.cardType} style={{ color: catColor }}>
                    {card.typeLine}
                  </p>
                  <p className={styles.cardDesc}>{card.description}</p>

                  {!isImplemented && (
                    <p className={styles.implementationHint}>
                      Disabled for testing until the runtime behavior exists.
                    </p>
                  )}
                  {isSharedLocked && (
                    <p className={styles.implementationHint}>
                      Shared modifier already claimed by {opponentName}.
                    </p>
                  )}
                  {selectedByOpponent && !isSharedLocked && (
                    <p className={styles.implementationHint}>
                      Owned modifier. Both sides may draft this independently.
                    </p>
                  )}

                  <button
                    className={styles.flavorToggle}
                    onClick={e => {
                      e.stopPropagation();
                      playClick();
                      setExpandedId(isExpanded ? null : card.id);
                    }}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Hide flavor ^' : 'Flavor text v'}
                  </button>
                  {isExpanded && <p className={styles.cardFlavor}>{card.flavor}</p>}

                  <div className={styles.cardFooter}>
                    <span className={styles.categoryLabel} style={{ color: catColor }}>
                      {CATEGORY_NAMES[card.category]}
                    </span>
                    <CursePips level={card.curseLevel} />
                  </div>
                </div>

                {selectedByPlayer && (
                  <div className={styles.selectedBadge} style={{ background: catColor }}>
                    +
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside className={styles.panel}>
        <div className={styles.panelInner}>
          <h2 className={styles.panelHeading}>Draft Summary</h2>

          <div className={styles.budgetSection}>
            <div className={styles.budgetRow}>
              <span className={styles.budgetLabel}>Your Budget</span>
              <span className={styles.budgetValue}>
                {playerTotalCost} / {BUDGET} pts
              </span>
            </div>
            <div className={styles.budgetTrack}>
              <div className={styles.budgetFill} style={{ width: `${barPct}%` }} />
            </div>
            <p className={styles.budgetHint}>
              {remaining > 0 ? `${remaining} pts remaining` : 'Budget full'}
            </p>
          </div>

          <div className={styles.countRow}>
            <span className={styles.countLabel}>Draft Turn</span>
            <span className={styles.countValue}>
              {draftTurn === 'player' ? 'You' : draftTurn === 'opponent' ? opponentName : 'Done'}
            </span>
          </div>

          <div className={styles.selectedList}>
            {playerSelected.length === 0 ? (
              <p className={styles.emptySelected}>
                No player picks yet.
                <span>Choose the first modifier to open the draft.</span>
              </p>
            ) : (
              playerSelected.map(card => (
                <div key={card.id} className={styles.selectedItem}>
                  <div
                    className={styles.selectedDot}
                    style={{ background: CATEGORY_COLORS[card.category] }}
                  />
                  <span className={styles.selectedName}>{card.name}</span>
                  <span
                    className={`${styles.selectedCost} ${
                      card.cost < 0 ? styles.costNegative : ''
                    }`}
                  >
                    {getCostDisplay(card.cost)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className={styles.opponentBlock}>
            <div className={styles.opponentHeader}>
              <span className={styles.countLabel}>{opponentName} Draft</span>
              <span className={styles.countValue}>
                {botSelected.length} / {MAX_COUNT}
              </span>
            </div>
            <div className={styles.selectedList}>
              {botSelected.length === 0 ? (
                <p className={styles.emptySelected}>{opponentName} has not picked yet.</p>
              ) : (
                botSelected.map(card => (
                  <div key={card.id} className={styles.selectedItem}>
                    <div
                      className={styles.selectedDot}
                      style={{ background: CATEGORY_COLORS[card.category] }}
                    />
                    <span className={styles.selectedName}>{card.name}</span>
                    <span
                      className={`${styles.selectedCost} ${
                        card.cost < 0 ? styles.costNegative : ''
                      }`}
                    >
                      {getCostDisplay(card.cost)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className={styles.rulesHint}>
            Max {MAX_COUNT} modifiers - {MAX_PER_CATEGORY} per category - Shared effects are
            single-claim - Owned effects may be drafted by both sides
          </p>

          <div className={styles.viktorQuote}>
            <p className={styles.viktorText}>
              {draftFinished
                ? '"The draft is settled. Viktor has stopped pretending there was a clean answer."'
                : draftTurn === 'opponent'
                  ? `"${opponentName} is picking now. Viktor trusts the chaos generator more than the birds."`
                  : '"You pick first. The bird picks second. This was the diplomatic compromise."'}
            </p>
            <span className={styles.viktorAttr}>- Viktor Crumb</span>
          </div>

          <div className={styles.actions}>
            <button className={styles.startBtn} onClick={handleFinishDraft}>
              {draftFinished ? 'Start Match' : 'Finish Draft & Start Match'}
            </button>
            <button
              className={styles.backBtn}
              onClick={() => {
                playClick();
                onBack();
              }}
            >
              Back to Bot Select
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
