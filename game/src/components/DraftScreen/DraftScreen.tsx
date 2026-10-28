import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ALL_MODIFIERS,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  type ModifierCard,
  type ModifierCategory,
} from '@pigeon-chess/game-core';
import { modifierRegistry } from '@pigeon-chess/game-core';
import { isSharedDraftModifier } from '@pigeon-chess/game-core';
import { playClick } from '../../sound';
import styles from './DraftScreen.module.css';
import PrototypeRules from '../PrototypeRules/PrototypeRules';
import { getCurseLabel, getTierLabel } from '../../modifiers/presentation';
import {
  BUDGET,
  MAX_COUNT,
  MAX_PER_CATEGORY,
  getSelectedCards,
  getValidOptions,
  pickBlocker,
  pickRandomCard,
  runRandomDraft,
} from './draftRules';


type DraftTurn = 'player' | 'opponent' | 'done';

/** An online draft: the server owns the picks, this screen only shows and sends them. */
export interface OnlineDraftControls {
  myPicks: string[];
  theirPicks: string[];
  turn: DraftTurn;
  /** This side has stopped picking. */
  iAmDone: boolean;
  onPick: (modifierId: string) => void;
  onFinish: () => void;
}

interface DraftScreenProps {
  onStartMatch?: (playerSelectedIds: string[], opponentSelectedIds: string[]) => void;
  onBack: () => void;
  opponentName?: string;
  opponentModifierIds?: string[];
  online?: OnlineDraftControls;
  /** VS Bots practice (GDD): no limits, and you pick for both sides. */
  practice?: boolean;
}

type CategoryFilter = 'ALL' | ModifierCategory;

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'A', label: 'Board' },
  { key: 'B', label: 'Cursed' },
  { key: 'C', label: 'Abilities' },
  { key: 'D', label: 'Fog' },
  { key: 'E', label: 'Army' },
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

export default function DraftScreen({
  onStartMatch,
  onBack,
  opponentName = 'Opponent',
  opponentModifierIds = [],
  online,
  practice = false,
}: DraftScreenProps) {
  const [localPlayerIds, setPlayerSelectedIds] = useState<string[]>([]);
  const [localBotIds, setBotSelectedIds] = useState<string[]>(opponentModifierIds);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [hideUnavailable, setHideUnavailable] = useState(true);
  const [localTurn, setDraftTurn] = useState<DraftTurn>('player');
  const playerSelectedIds = online ? online.myPicks : localPlayerIds;
  const botSelectedIds = online ? online.theirPicks : localBotIds;
  const draftTurn = online ? online.turn : practice ? 'player' : localTurn;
  /** Practice only: whose draft a pick goes into. */
  const [practiceSide, setPracticeSide] = useState<'player' | 'opponent'>('player');
  const forBot = practice && practiceSide === 'opponent';
  const sideIds = forBot ? botSelectedIds : playerSelectedIds;
  const otherSideIds = forBot ? playerSelectedIds : botSelectedIds;
  const ruleOptions = { unlimited: practice };

  /** Why this side can't take this card, ignoring whose turn it is. */
  const blockerFor = (card: ModifierCard) =>
    pickBlocker(card, sideIds, otherSideIds, implementedIds, forBot ? 'You' : opponentName, ruleOptions);
  /** Set by the random draft. The picks cannot be changed afterwards. */
  const [randomLocked, setRandomLocked] = useState(false);
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
    if (online || practice || draftTurn !== 'opponent') return;

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
  }, [online, practice, draftTurn, botValidOptions, botSelectedIds, implementedIds, playerSelectedIds]);

  useEffect(() => {
    if (online || practice || draftTurn !== 'player') return;
    if (playerValidOptions.length > 0) return;

    if (botValidOptions.length > 0) {
      setDraftTurn('opponent');
    } else {
      setDraftTurn('done');
    }
  }, [online, practice, draftTurn, playerValidOptions, botValidOptions]);

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
    if (practice) return blockerFor(card) === null;
    return playerValidOptions.some(option => option.id === card.id);
  }

  function handlePlayerPick(card: ModifierCard) {
    if (!isCardSelectable(card)) return;
    if (online) {
      online.onPick(card.id);
      return;
    }
    if (practice) {
      if (forBot) setBotSelectedIds(ids => [...ids, card.id]);
      else setPlayerSelectedIds(ids => [...ids, card.id]);
      return;
    }

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

  function handleRandomDraft() {
    if (draftTurn !== 'player' || playerSelectedIds.length > 0) return;
    playClick();
    const result = runRandomDraft(playerSelectedIds, botSelectedIds, implementedIds);
    setPlayerSelectedIds(result.playerIds);
    setBotSelectedIds(result.botIds);
    setRandomLocked(true);
    setDraftTurn('done');
  }

  function handleFinishDraft() {
    playClick();
    if (online) online.onFinish();
    else onStartMatch?.(playerSelectedIds, botSelectedIds);
  }

  const [detailId, setDetailId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const detailCard = detailId ? ALL_MODIFIERS.find(card => card.id === detailId) ?? null : null;
  const turnLabel = practice
    ? 'Practice · no limits'
    : draftTurn === 'player' ? 'Your pick' : draftTurn === 'opponent' ? `${opponentName} is picking…` : 'Draft complete';

  function pickFromDetail(card: ModifierCard) {
    playClick();
    handlePlayerPick(card);
    setDetailId(null);
  }

  function removeFromPractice(card: ModifierCard) {
    playClick();
    if (forBot) setBotSelectedIds(ids => ids.filter(id => id !== card.id));
    else setPlayerSelectedIds(ids => ids.filter(id => id !== card.id));
    setDetailId(null);
  }

  const actions = online ? (
    online.iAmDone ? (
      <span className={styles.waitNote}>Waiting for {opponentName} to finish.</span>
    ) : (
      <button
        className={styles.primaryBtn}
        onClick={handleFinishDraft}
        title={`Stop drafting. ${opponentName} can keep picking.`}
      >
        Done picking
      </button>
    )
  ) : practice ? (
    <button className={styles.primaryBtn} onClick={handleFinishDraft}>
      Start match
    </button>
  ) : (
    <>
      {!draftFinished && playerSelectedIds.length === 0 && (
        <button
          className={styles.secondaryBtn}
          onClick={handleRandomDraft}
          disabled={draftTurn !== 'player'}
          title="Both sides get random picks. You cannot change them."
        >
          Random
        </button>
      )}
      <button className={styles.primaryBtn} onClick={handleFinishDraft}>
        Start match
      </button>
    </>
  );

  const summary = (
    <>
      <DraftList title="Your draft" cards={playerSelected} max={practice ? undefined : MAX_COUNT} empty="Nothing yet. Tap a modifier to read it, then draft it." />
      <DraftList
        title={`${opponentName}'s draft`}
        cards={botSelected}
        max={practice ? undefined : MAX_COUNT}
        empty={practice ? `Switch to ${opponentName} above to give it modifiers.` : `${opponentName} has not picked yet.`}
      />
      <p className={styles.rules}>
        {practice
          ? 'Practice: no budget, count or category limits. Shared effects can still only be claimed once.'
          : `${MAX_COUNT} modifiers max · ${MAX_PER_CATEGORY} per category · ${BUDGET} pt budget. Shared effects can only be
        claimed once; owned effects can be drafted by both sides.`}
      </p>
    </>
  );

  return (
    <div className={styles.root}>
      <header className={styles.topBar}>
        <div className={styles.topRow}>
          <button
            className={styles.backBtn}
            onClick={() => {
              playClick();
              onBack();
            }}
            aria-label={online ? 'Leave the room' : 'Back to bot select'}
          >
            &lt;-
          </button>
          <div className={styles.titleBlock}>
            <h2 className={styles.heading}>Draft Modifiers</h2>
            <span className={`${styles.turn} ${draftTurn === 'player' ? styles.turnYou : ''}`} aria-live="polite">
              {randomLocked ? 'Random draft locked in' : turnLabel}
            </span>
          </div>
        </div>

        {practice ? (
          <div className={styles.chips} role="radiogroup" aria-label="Drafting for">
            {(['player', 'opponent'] as const).map(side => (
              <button
                key={side}
                role="radio"
                aria-checked={practiceSide === side}
                className={`${styles.chip} ${practiceSide === side ? styles.chipOn : ''}`}
                onClick={() => {
                  playClick();
                  setPracticeSide(side);
                }}
              >
                Drafting for {side === 'player' ? 'you' : opponentName}
              </button>
            ))}
          </div>
        ) : (
        <div className={styles.meters}>
          <div className={styles.meter}>
            <div className={styles.meterLabel}>
              <span>Budget</span>
              <span className={remaining < 0 ? styles.over : ''}>{playerTotalCost} / {BUDGET} pts</span>
            </div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${barPct}%` }} />
            </div>
          </div>
          <div className={styles.pickDots} aria-label={`${playerSelected.length} of ${MAX_COUNT} picks`}>
            {Array.from({ length: MAX_COUNT }, (_, i) => {
              const card = playerSelected[i];
              return (
                <span
                  key={i}
                  className={`${styles.pickDot} ${card ? styles.pickDotOn : ''}`}
                  style={card ? { background: CATEGORY_COLORS[card.category] } : undefined}
                />
              );
            })}
          </div>
        </div>
        )}

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            placeholder="Search modifiers"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search modifiers"
          />
          <div className={styles.chips} role="group" aria-label="Category filter">
            {CATEGORY_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                aria-pressed={activeCategory === key}
                className={`${styles.chip} ${activeCategory === key ? styles.chipOn : ''}`}
                style={key !== 'ALL' ? ({ '--cat': CATEGORY_COLORS[key] } as CSSProperties) : undefined}
                onClick={() => {
                  playClick();
                  setActiveCategory(key);
                }}
              >
                {key !== 'ALL' && <span className={styles.chipDot} aria-hidden="true" />}
                {label}
              </button>
            ))}
            <button
              aria-pressed={!hideUnavailable}
              className={`${styles.chip} ${!hideUnavailable ? styles.chipOn : ''}`}
              onClick={() => {
                playClick();
                setHideUnavailable(hide => !hide);
              }}
            >
              Show upcoming
            </button>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.grid} aria-label="Modifiers">
          {filtered.length === 0 && <p className={styles.empty}>No modifiers match.</p>}
          {filtered.map(card => {
            const mine = playerSelectedIds.includes(card.id);
            const theirs = botSelectedIds.includes(card.id);
            const blocked = !sideIds.includes(card.id) && blockerFor(card) !== null;
            const tag = mine
              ? 'Your pick'
              : theirs
                ? `${opponentName}'s pick`
                : !implementedIds.has(card.id)
                  ? 'Coming soon'
                  : null;
            return (
              <button
                key={card.id}
                className={`${styles.card} ${mine ? styles.cardMine : ''} ${blocked ? styles.cardBlocked : ''}`}
                style={{ '--cat': CATEGORY_COLORS[card.category] } as CSSProperties}
                onClick={() => {
                  playClick();
                  setDetailId(card.id);
                }}
              >
                <span className={styles.cardTop}>
                  <span className={styles.cardName}>{card.name}</span>
                  <span className={`${styles.cost} ${card.cost < 0 ? styles.costRefund : ''}`}>{getCostDisplay(card.cost)}</span>
                </span>
                <span className={styles.cardType}>{card.typeLine}</span>
                <span className={styles.cardDesc}>{card.description}</span>
                {tag && <span className={`${styles.tag} ${mine ? styles.tagMine : ''}`}>{tag}</span>}
              </button>
            );
          })}
        </main>

        <aside className={styles.side}>
          {summary}
          <div className={styles.viktor}>
            <p className={styles.viktorText}>
              {practice
                ? '"Practice. Hand out whatever you like. Viktor will pretend this is science."'
                : draftFinished
                ? '"The draft is settled. Viktor has stopped pretending there was a clean answer."'
                : online
                  ? '"White picks first, then you take turns. Tap Done picking when you have enough."'
                  : draftTurn === 'opponent'
                    ? `"${opponentName} is picking now. Viktor trusts the chaos generator more than the birds."`
                    : '"You pick first. The bird picks second. This was the diplomatic compromise."'}
            </p>
            <span className={styles.viktorAttr}>Viktor Crumb</span>
          </div>
          <div className={styles.sideActions}>{actions}</div>
        </aside>
      </div>

      {/* Phones: summary and actions live in a bar pinned to the bottom. */}
      <footer className={styles.actionBar}>
        <button className={styles.picksBtn} onClick={() => setSummaryOpen(true)}>
          <strong>{practice ? playerSelected.length + botSelected.length : `${playerSelected.length}/${MAX_COUNT}`}</strong> picks
        </button>
        {actions}
      </footer>

      {summaryOpen && (
        <div className={styles.sheetBackdrop} onClick={() => setSummaryOpen(false)}>
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Draft summary" onClick={e => e.stopPropagation()}>
            <div className={styles.sheetGrip} aria-hidden="true" />
            {summary}
            <button className={styles.secondaryBtn} onClick={() => setSummaryOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {detailCard && (
        <div className={styles.sheetBackdrop} onClick={() => setDetailId(null)}>
          <div
            className={`${styles.sheet} ${styles.detail}`}
            style={{ '--cat': CATEGORY_COLORS[detailCard.category] } as CSSProperties}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modifier-detail-title"
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.sheetGrip} aria-hidden="true" />
            <div className={styles.detailHead}>
              <span className={styles.detailCategory}>{CATEGORY_NAMES[detailCard.category]}</span>
              <span className={`${styles.cost} ${detailCard.cost < 0 ? styles.costRefund : ''}`}>{getCostDisplay(detailCard.cost)}</span>
            </div>
            <h3 id="modifier-detail-title" className={styles.detailName}>{detailCard.name}</h3>
            <p className={styles.detailType}>
              {detailCard.typeLine}
            </p>
            <p className={styles.detailType}>
              {getTierLabel(detailCard.tier)} · {getCurseLabel(detailCard.curseLevel)} <CursePips level={detailCard.curseLevel} />
            </p>
            <p className={styles.detailDesc}>{detailCard.description}</p>
            <PrototypeRules text={detailCard.prototypeRules} />
            {detailCard.flavor && <p className={styles.flavor}>{detailCard.flavor}</p>}
            {isSharedDraftModifier(detailCard.id) && (
              <p className={styles.note}>Shared: affects both sides, and only one side can draft it.</p>
            )}

            {(() => {
              const mine = sideIds.includes(detailCard.id);
              const reason = mine ? null : blockerFor(detailCard);
              const waiting = !mine && !reason && draftTurn !== 'player';
              return (
                <div className={styles.detailActions}>
                  {mine && practice ? (
                    <button className={styles.secondaryBtn} onClick={() => removeFromPractice(detailCard)}>
                      Remove from {forBot ? `${opponentName}'s` : 'your'} draft
                    </button>
                  ) : mine ? (
                    <p className={styles.detailState}>In your draft.</p>
                  ) : reason ? (
                    <p className={styles.detailState}>{reason}</p>
                  ) : waiting ? (
                    <p className={styles.detailState}>{draftFinished ? 'The draft is over.' : `Wait for ${opponentName} to pick.`}</p>
                  ) : (
                    <button className={styles.primaryBtn} onClick={() => pickFromDetail(detailCard)}>
                      {forBot ? `Give to ${opponentName}` : 'Draft this modifier'}
                    </button>
                  )}
                  <button className={styles.secondaryBtn} onClick={() => setDetailId(null)}>Close</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function DraftList({ title, cards, max, empty }: { title: string; cards: ModifierCard[]; max?: number; empty: string }) {
  return (
    <section className={styles.draftList}>
      <h3 className={styles.listTitle}>
        <span>{title}</span>
        <span>{max === undefined ? cards.length : `${cards.length} / ${max}`}</span>
      </h3>
      {cards.length === 0 ? (
        <p className={styles.listEmpty}>{empty}</p>
      ) : (
        cards.map(card => (
          <div key={card.id} className={styles.listItem}>
            <span className={styles.listDot} style={{ background: CATEGORY_COLORS[card.category] }} />
            <span className={styles.listName}>{card.name}</span>
            <span className={`${styles.listCost} ${card.cost < 0 ? styles.costRefund : ''}`}>{getCostDisplay(card.cost)}</span>
          </div>
        ))
      )}
    </section>
  );
}
