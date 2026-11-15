import { ALL_MODIFIERS, type ModifierCard } from '../modifiers/data';
import { isSharedDraftModifier } from '../modifiers/scope';
import { MODIFIER_IDS } from '../modifiers/ids';

/** Cat Mode only does something with It's Dark And I'm Scared, so it waits for that card. */
function needsDarkFirst(cardId: string, ownIds: string[], otherIds: string[]): boolean {
  return cardId === MODIFIER_IDS.catMode
    && !ownIds.includes(MODIFIER_IDS.darkAndScared)
    && !otherIds.includes(MODIFIER_IDS.darkAndScared);
}

/**
 * Cards one side cannot hold together, because one removes the piece the
 * other upgrades: Three Of Them turns the Queen into a Royal Guard, and
 * The Small Council has no bishops.
 */
const OWN_CONFLICTS: ReadonlyArray<readonly [string, string]> = [
  [MODIFIER_IDS.slayQueen, MODIFIER_IDS.threeKings],
  [MODIFIER_IDS.holyKnight, MODIFIER_IDS.smallCouncil],
];

/** The card in your draft that rules this one out, if any. */
function ownConflict(cardId: string, ownIds: string[]): string | null {
  for (const [a, b] of OWN_CONFLICTS) {
    if (cardId === a && ownIds.includes(b)) return b;
    if (cardId === b && ownIds.includes(a)) return a;
  }
  return null;
}

export const BUDGET = 8;
export const MAX_COUNT = 5;
export const MAX_PER_CATEGORY = 2;

export interface DraftRuleOptions {
  /** Practice sandbox (GDD VS Bots): no budget, count or category caps. */
  unlimited?: boolean;
}

export function getSelectedCards(ids: string[]) {
  return ALL_MODIFIERS.filter(mod => ids.includes(mod.id));
}

function getCategoryCounts(cards: ModifierCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    counts[card.category] = (counts[card.category] ?? 0) + 1;
  }
  return counts;
}

export function getValidOptions(
  ownIds: string[],
  otherIds: string[],
  implementedIds: Set<string>,
  { unlimited = false }: DraftRuleOptions = {},
): ModifierCard[] {
  const ownCards = getSelectedCards(ownIds);
  const ownCounts = getCategoryCounts(ownCards);
  const totalCost = ownCards.reduce((sum, card) => sum + card.cost, 0);

  return ALL_MODIFIERS.filter(card => {
    if (!implementedIds.has(card.id)) return false;
    if (ownIds.includes(card.id)) return false;
    if (isSharedDraftModifier(card.id) && otherIds.includes(card.id)) return false;
    if (needsDarkFirst(card.id, ownIds, otherIds)) return false;
    if (ownConflict(card.id, ownIds)) return false;
    if (unlimited) return true;
    if (ownCards.length >= MAX_COUNT) return false;
    if (totalCost + card.cost > BUDGET) return false;
    if ((ownCounts[card.category] ?? 0) >= MAX_PER_CATEGORY) return false;
    return true;
  });
}

/** `random` should come from `seededRandom` so the draft can be replayed. */
export function pickRandomCard(cards: ModifierCard[], random: () => number): ModifierCard | null {
  if (cards.length === 0) return null;
  return cards[Math.floor(random() * cards.length)] ?? null;
}

/**
 * Plays out the rest of the alternating draft with random picks for both
 * sides, starting with the player. Used by the locked random draft.
 */
export function runRandomDraft(
  playerIds: string[],
  botIds: string[],
  implementedIds: Set<string>,
  random: () => number,
): { playerIds: string[]; botIds: string[] } {
  let player = [...playerIds];
  let bot = [...botIds];
  const pick = (cards: ModifierCard[]) => cards[Math.floor(random() * cards.length)];
  for (;;) {
    const playerOptions = getValidOptions(player, bot, implementedIds);
    if (playerOptions.length > 0) player = [...player, pick(playerOptions).id];
    const botOptions = getValidOptions(bot, player, implementedIds);
    if (botOptions.length > 0) bot = [...bot, pick(botOptions).id];
    if (playerOptions.length === 0 && botOptions.length === 0) return { playerIds: player, botIds: bot };
  }
}

/**
 * Why a side can't draft this card right now, in player words, or null when
 * it can. Mirrors getValidOptions so the detail sheet can explain itself.
 */
export function pickBlocker(
  card: ModifierCard,
  ownIds: string[],
  otherIds: string[],
  implementedIds: Set<string>,
  otherName = 'Your opponent',
  { unlimited = false }: DraftRuleOptions = {},
): string | null {
  const ownCards = getSelectedCards(ownIds);
  const ownCost = ownCards.reduce((sum, c) => sum + c.cost, 0);
  if (!implementedIds.has(card.id)) return 'Not in this build yet.';
  if (ownIds.includes(card.id)) return 'Already in your draft.';
  if (isSharedDraftModifier(card.id) && otherIds.includes(card.id)) return `${otherName} already claimed this shared modifier.`;
  if (needsDarkFirst(card.id, ownIds, otherIds)) return 'Needs It\'s Dark And I\'m Scared in the match first.';
  const conflict = ownConflict(card.id, ownIds);
  if (conflict) {
    const name = ALL_MODIFIERS.find(c => c.id === conflict)?.name ?? conflict;
    return `Does not work with ${name}.`;
  }
  if (unlimited) return null;
  if (ownCards.length >= MAX_COUNT) return `Your draft is full (${MAX_COUNT} modifiers).`;
  if (ownCost + card.cost > BUDGET) return `Over budget: ${BUDGET - ownCost} pts left.`;
  if ((getCategoryCounts(ownCards)[card.category] ?? 0) >= MAX_PER_CATEGORY) {
    return `You already have ${MAX_PER_CATEGORY} from this category.`;
  }
  return null;
}
