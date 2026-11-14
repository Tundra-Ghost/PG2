import type { Screen } from './routes';

/** What the coach's main button does. 'wait' shows no button: the player acts. */
export type TutorialAction = 'next' | 'start-match' | 'wait' | 'finish';

export interface TutorialStep {
  id: string;
  /** The screen this step explains. */
  screen: Screen;
  title: string;
  body: string;
  /** Phone wording, when touch works differently from a mouse. */
  touchBody?: string;
  action: TutorialAction;
  button?: string;
}

/** The guided first match against Chick: menu, draft, match. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    screen: 'menu',
    title: 'Welcome to Pigeon Chess',
    body: 'Every match is chess with modifiers: cards that bend the rules. Let\'s play one against Chick, the easiest bot.',
    action: 'start-match',
    button: 'Play Chick',
  },
  {
    id: 'draft-cards',
    screen: 'draft',
    title: 'Draft your modifiers',
    body: 'Each card changes the game. Click a card to read it, then pick it. You can take up to 5.',
    touchBody: 'Each card changes the game. Tap a card to read it, then pick it. You can take up to 5.',
    action: 'next',
  },
  {
    id: 'draft-budget',
    screen: 'draft',
    title: 'Budget and curses',
    body: 'Cards cost points from your budget. Red Cursed cards work against you, but they give points back. Take a curse to afford a stronger card.',
    action: 'next',
  },
  {
    id: 'draft-start',
    screen: 'draft',
    title: 'Ready?',
    body: 'Pick a few cards, or press Random. Then press Start match.',
    action: 'wait',
  },
  {
    id: 'match-move',
    screen: 'game',
    title: 'Your move',
    body: 'You play white. Click a piece, then click a highlighted square to move it.',
    touchBody: 'You play white. Tap a piece, then tap a highlighted square to move it.',
    action: 'next',
  },
  {
    id: 'match-read',
    screen: 'game',
    title: 'Read the board',
    body: 'Hover over a square to see what is on it: a piece\'s powers, lava, smoke and more.',
    touchBody: 'Hold your finger on a square to see what is on it. Let go to close it.',
    action: 'next',
  },
  {
    id: 'match-modifiers',
    screen: 'game',
    title: 'Modifiers in play',
    body: 'The right panel lists every card in this match: yours, shared ones, and Chick\'s.',
    touchBody: 'Tap Modifiers at the bottom to see every card in this match: yours, shared ones, and Chick\'s.',
    action: 'next',
  },
  {
    id: 'match-chat',
    screen: 'game',
    title: 'Chick talks back',
    body: 'Lines pop up in a dialogue box. Click it to skip ahead. You can chat too in the Chat panel.',
    touchBody: 'Lines pop up in a dialogue box. Tap it to skip ahead. You can chat too under Moves & Chat.',
    action: 'next',
  },
  {
    id: 'match-goal',
    screen: 'game',
    title: 'Win the game',
    body: 'Checkmate Chick to win. When it ends, New Game takes you back to the draft. Have fun!',
    action: 'finish',
    button: 'Got it',
  },
];

const KEY = 'pg2-tutorial';

/** True once the player finished or skipped the tour, so it is not offered again. */
export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}

export function markTutorialSeen(outcome: 'done' | 'skipped'): void {
  try {
    localStorage.setItem(KEY, outcome);
  } catch {
    // Storage blocked: the offer may show again next visit.
  }
}

/**
 * The step to show after the screen changes. Moving forward to a screen the
 * tour covers jumps to that screen's first step; leaving the tour's path ends it.
 */
export function stepForScreen(current: number, screen: Screen): number | null {
  if (TUTORIAL_STEPS[current].screen === screen) return current;
  if (screen === 'settings') return current;
  const next = TUTORIAL_STEPS.findIndex((step, index) => index > current && step.screen === screen);
  return next === -1 ? null : next;
}
