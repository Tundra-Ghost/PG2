import { SPRITES } from './characters';

export type BotId = 'chick' | 'pigeon' | 'magnus';
export type OpponentId = BotId | `npc:${string}`;

export interface OpponentProfile {
  id: OpponentId;
  kind: 'bot' | 'npc';
  icon: string;
  /** Pixel art portrait; takes the place of the emoji icon. */
  sprite?: string;
  portraitSlotLabel: string;
  dialogueTheme: 'player' | 'chick' | 'measured' | 'grandmaster' | 'npc';
  name: string;
  tagline: string;
  description: string;
  difficulty: number;
  available: boolean;
  reactionPersonaId: string;
}

export type DialogueExpression = 'neutral' | 'shocked' | 'smug' | 'frustrated';

export const BOTS: OpponentProfile[] = [
  {
    id: 'chick',
    kind: 'bot',
    icon: '🐣',
    sprite: SPRITES.chick,
    portraitSlotLabel: 'Chick Portrait',
    dialogueTheme: 'chick',
    name: 'Chick',
    tagline: 'Depth-1 · Material Evaluation',
    description: 'Grabs whatever looks tastiest. No plans. No remorse. Perfect for testing modifiers.',
    difficulty: 1,
    available: true,
    reactionPersonaId: 'chick',
  },
  {
    id: 'pigeon',
    kind: 'bot',
    icon: '🐦',
    sprite: SPRITES.pigeon,
    portraitSlotLabel: 'Pigeon Portrait',
    dialogueTheme: 'measured',
    name: 'Pigeon',
    tagline: 'Depth-3 · Positional Heuristics',
    description: 'Knows when to strut and when to scatter. Reads three moves ahead and steps around lava.',
    difficulty: 2,
    available: true,
    reactionPersonaId: 'measured',
  },
  {
    id: 'magnus',
    kind: 'bot',
    icon: '🦅',
    sprite: SPRITES.magnus,
    portraitSlotLabel: 'Magnus Portrait',
    dialogueTheme: 'grandmaster',
    name: 'Magnus Jr.',
    tagline: 'Deep Search · Endgame Tables',
    description:
      'Modelled after a grandmaster pigeon that escaped a Swiss tournament in 2019. Undefeated.',
    difficulty: 3,
    available: false,
    reactionPersonaId: 'grandmaster',
  },
];

export function getBotProfile(botId: BotId | null): OpponentProfile | null {
  if (!botId) return null;
  return BOTS.find(bot => bot.id === botId) ?? null;
}
