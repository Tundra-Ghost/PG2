import { ALL_MODIFIERS, type ModifierCard } from '../modifiers/data';
import { isSharedDraftModifier } from '../modifiers/scope';
import { MODIFIER_IDS } from '../modifiers/ids';
import { modifierRegistry } from '../modifiers/registry';
import { TIMED_EVENT_CARDS } from '../modifiers/definitions/crystal-ball';

/** Cat Mode only does something with It's Dark And I'm Scared, so it waits for that card. */
function needsDarkFirst(cardId: string, ownIds: string[], otherIds: string[]): boolean {
  return cardId === MODIFIER_IDS.catMode
    && !ownIds.includes(MODIFIER_IDS.darkAndScared)
    && !otherIds.includes(MODIFIER_IDS.darkAndScared);
}

/** Cards that hide squares. Footprints and Flashlight wait for one of them. */
export const FOG_CARDS: readonly string[] = [MODIFIER_IDS.darkAndScared, MODIFIER_IDS.knownUnknowns, MODIFIER_IDS.smokeCloud];

/**
 * Support cards that do nothing alone, like Cat Mode: why one is not offered
 * yet, in player words, or null when it is. Tells waits for an ability card
 * on the other side.
 */
function needsPartner(cardId: string, ownIds: string[], otherIds: string[]): string | null {
  const all = [...ownIds, ...otherIds];
  if (cardId === MODIFIER_IDS.footprints || cardId === MODIFIER_IDS.flashlight) {
    return all.some(id => FOG_CARDS.includes(id)) ? null : 'Needs a fog card in the match first.';
  }
  if (cardId === MODIFIER_IDS.crystalBall) {
    return all.some(id => TIMED_EVENT_CARDS.includes(id)) ? null : 'Needs a card with timed board events in the match first.';
  }
  if (cardId === MODIFIER_IDS.tells) {
    return otherIds.some(id => modifierRegistry.get(id)?.ability) ? null : 'Needs an ability card on the other side first.';
  }
  return null;
}

/**
 * Cards one side cannot hold together, because one removes the piece the
 * other upgrades: Three Of Them turns the Queen into a Royal Guard, and
 * The Small Council has no bishops. Elephant In The Room turns every bishop
 * into an Elephant, so Holy Knight and Forgive Me would have no bishop.
 * Lawrence Of Arabia, Knight Rider and Hatoful Gambit all replace the knights.
 * Stonks and The Small Council both rebuild the pawns.
 * The Small Council fills the third rank, so Hatchery has no nest.
 * Run, Forrest, Run would let a Heavy Is The Crown King skip its order.
 * Peer Pressure and Main Character Syndrome demand different pieces on the
 * same move, and so does Roll For Initiative with either. Yeah, There Are Three Of Them (Three Kings) has no Queen, so Main Character Syndrome would be free.
 * Overseas Hire, Hopscotch and The Chancellor could each pick the same rook.
 * The Bodyguard replaces the g-pawn, which The Small Council moves, and its
 * swap would let a Heavy Is The Crown King skip its order.
 * Leap Of Faith needs a bishop: The Small Council has none, and Elephant In The Room turns them into Elephants.
 * MINE! and Death And Taxes are priced for 8 pawns; The Small Council's 12 would make them cheap curses.
 * Invisibility Cloak and Camouflage both hide your pieces, so one player may not draft both.
 * Shell Game disguises your Queen: Sus could disguise the same piece, Yeah, There Are Three Of Them has no Queen, and
 * Main Character Syndrome, Imposter Syndrome and Berserker mark the Queen in plain sight.
 */
const OWN_CONFLICTS: ReadonlyArray<readonly [string, string]> = [
  [MODIFIER_IDS.slayQueen, MODIFIER_IDS.threeKings],
  [MODIFIER_IDS.holyKnight, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.elephantInTheRoom, MODIFIER_IDS.holyKnight],
  [MODIFIER_IDS.elephantInTheRoom, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.elephantInTheRoom, MODIFIER_IDS.forgiveMe],
  [MODIFIER_IDS.lawrenceOfArabia, MODIFIER_IDS.hatofulGambit],
  [MODIFIER_IDS.lawrenceOfArabia, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.knightRider, MODIFIER_IDS.hatofulGambit],
  [MODIFIER_IDS.knightRider, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.knightRider, MODIFIER_IDS.lawrenceOfArabia],
  [MODIFIER_IDS.stonks, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.hatchery, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.runForrestRun, MODIFIER_IDS.heavyIsTheCrown],
  [MODIFIER_IDS.peerPressure, MODIFIER_IDS.mainCharacterSyndrome],
  [MODIFIER_IDS.mainCharacterSyndrome, MODIFIER_IDS.threeKings],
  [MODIFIER_IDS.rollForInitiative, MODIFIER_IDS.peerPressure],
  [MODIFIER_IDS.rollForInitiative, MODIFIER_IDS.mainCharacterSyndrome],
  [MODIFIER_IDS.overseasHire, MODIFIER_IDS.chancellor],
  [MODIFIER_IDS.hopscotch, MODIFIER_IDS.chancellor],
  [MODIFIER_IDS.hopscotch, MODIFIER_IDS.overseasHire],
  [MODIFIER_IDS.leapOfFaith, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.leapOfFaith, MODIFIER_IDS.elephantInTheRoom],
  [MODIFIER_IDS.theBodyguard, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.theBodyguard, MODIFIER_IDS.heavyIsTheCrown],
  [MODIFIER_IDS.getOverHere, MODIFIER_IDS.threeKings],
  [MODIFIER_IDS.imposterSyndrome, MODIFIER_IDS.threeKings],
  [MODIFIER_IDS.mine, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.deathAndTaxes, MODIFIER_IDS.smallCouncil],
  [MODIFIER_IDS.invisibilityCloak, MODIFIER_IDS.camouflage],
  [MODIFIER_IDS.shellGame, MODIFIER_IDS.sus],
  [MODIFIER_IDS.shellGame, MODIFIER_IDS.threeKings],
  [MODIFIER_IDS.shellGame, MODIFIER_IDS.mainCharacterSyndrome],
  [MODIFIER_IDS.shellGame, MODIFIER_IDS.imposterSyndrome],
  [MODIFIER_IDS.shellGame, MODIFIER_IDS.berserker],
];

/**
 * Shared cards whose squares overlap, so only one may be in a match, whoever
 * drafts it. Checked against both drafts.
 * Thinking With Portals sits on c4 and f5: a Vent Tile or a flock could land on a portal.
 * Tide Goes In floods ranks 4 and 5: the Swamp, the roundabout, the portals and
 * flocks would sit in the water.
 * Crop Circles appear on ranks 3 to 6, over the Swamp, the roundabout, flocks
 * or the tide.
 * The Magic Roundabout turns d4, e4, e5 and d5: the Swamp and Gerald's statue
 * sit there, and the belts move the same squares at the same time.
 * Let It Go makes c3 to f6 ice: the Swamp, the portals and the tide sit on it
 * and change how far a piece may go there.
 * One Way Street: Bandersnatch mirrors the c-file onto the f-file, so every
 * copied move along them would go against the arrow.
 */
const MATCH_CONFLICTS: ReadonlyArray<readonly [string, string]> = [
  [MODIFIER_IDS.thinkingWithPortals, MODIFIER_IDS.ventTiles],
  [MODIFIER_IDS.thinkingWithPortals, MODIFIER_IDS.theBirds],
  [MODIFIER_IDS.tideGoesIn, MODIFIER_IDS.thisIsMySwamp],
  [MODIFIER_IDS.tideGoesIn, MODIFIER_IDS.theBirds],
  [MODIFIER_IDS.tideGoesIn, MODIFIER_IDS.thinkingWithPortals],
  [MODIFIER_IDS.tideGoesIn, MODIFIER_IDS.magicRoundabout],
  [MODIFIER_IDS.cropCircles, MODIFIER_IDS.thisIsMySwamp],
  [MODIFIER_IDS.cropCircles, MODIFIER_IDS.theBirds],
  [MODIFIER_IDS.cropCircles, MODIFIER_IDS.tideGoesIn],
  [MODIFIER_IDS.cropCircles, MODIFIER_IDS.magicRoundabout],
  [MODIFIER_IDS.magicRoundabout, MODIFIER_IDS.thisIsMySwamp],
  [MODIFIER_IDS.magicRoundabout, MODIFIER_IDS.factoryMustGrow],
  [MODIFIER_IDS.magicRoundabout, MODIFIER_IDS.monumentToGerald],
  [MODIFIER_IDS.oneWayStreet, MODIFIER_IDS.bandersnatch],
  [MODIFIER_IDS.letItGo, MODIFIER_IDS.thisIsMySwamp],
  [MODIFIER_IDS.letItGo, MODIFIER_IDS.thinkingWithPortals],
  [MODIFIER_IDS.letItGo, MODIFIER_IDS.tideGoesIn],
];

/** The card in either draft that rules this one out of the match, if any. */
function matchConflict(cardId: string, ownIds: string[], otherIds: string[]): string | null {
  const all = [...ownIds, ...otherIds];
  for (const [a, b] of MATCH_CONFLICTS) {
    if (cardId === a && all.includes(b)) return b;
    if (cardId === b && all.includes(a)) return a;
  }
  return null;
}

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
    if (needsPartner(card.id, ownIds, otherIds)) return false;
    if (ownConflict(card.id, ownIds)) return false;
    if (matchConflict(card.id, ownIds, otherIds)) return false;
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
  const partner = needsPartner(card.id, ownIds, otherIds);
  if (partner) return partner;
  const conflict = ownConflict(card.id, ownIds);
  if (conflict) {
    const name = ALL_MODIFIERS.find(c => c.id === conflict)?.name ?? conflict;
    return `Does not work with ${name}.`;
  }
  const clash = matchConflict(card.id, ownIds, otherIds);
  if (clash) {
    const name = ALL_MODIFIERS.find(c => c.id === clash)?.name ?? clash;
    return `Shares squares with ${name}, already in this match.`;
  }
  if (unlimited) return null;
  if (ownCards.length >= MAX_COUNT) return `Your draft is full (${MAX_COUNT} modifiers).`;
  if (ownCost + card.cost > BUDGET) return `Over budget: ${BUDGET - ownCost} pts left.`;
  if ((getCategoryCounts(ownCards)[card.category] ?? 0) >= MAX_PER_CATEGORY) {
    return `You already have ${MAX_PER_CATEGORY} from this category.`;
  }
  return null;
}
