import type { MoveRecord, PieceType } from './engine/types';
import {
  BOTS,
  getBotProfile,
  type BotId,
  type DialogueExpression,
  type OpponentId,
  type OpponentProfile,
} from './opponents';

export interface BotReactionInput {
  speakerId: OpponentId;
  moveRecord: MoveRecord;
  moveIndex: number;
  gameStatus: 'active' | 'checkmate' | 'draw' | 'abandoned' | 'draft';
}

export interface BotReactionOutput {
  text: string;
  expression: DialogueExpression;
}

type ReactionEventKey =
  | 'match_lost'
  | 'match_won'
  | 'lost_queen'
  | 'lost_major'
  | 'lost_minor'
  | 'lost_pawn'
  | 'won_queen'
  | 'won_major'
  | 'won_minor'
  | 'won_pawn';

type ReactionRule = {
  lines: string[];
  expression: DialogueExpression;
};

type ReactionPersona = Partial<Record<ReactionEventKey, ReactionRule>>;

const CHICK_PERSONA: ReactionPersona = {
  match_lost: {
    lines: [
      'I would like a rematch with fewer consequences.',
      'This result feels editorialized.',
    ],
    expression: 'frustrated',
  },
  match_won: {
    lines: [
      'Calculated. More or less.',
      'I am the rooftop now.',
    ],
    expression: 'smug',
  },
  lost_queen: {
    lines: [
      'That was the important one.',
      'I have made a strategic mistake.',
      'The large bird was not supposed to die.',
    ],
    expression: 'shocked',
  },
  lost_major: {
    lines: [
      'Hey. That was one of my serious pieces.',
      'That one had a union contract.',
    ],
    expression: 'frustrated',
  },
  lost_minor: {
    lines: [
      'I was using that bird.',
      'Rude. Extremely rude.',
    ],
    expression: 'frustrated',
  },
  lost_pawn: {
    lines: [
      'Acceptable losses. Probably.',
      'That chick was a volunteer.',
    ],
    expression: 'neutral',
  },
  won_queen: {
    lines: [
      'That looked expensive.',
      'I have captured the large bird.',
    ],
    expression: 'smug',
  },
  won_major: {
    lines: [
      'Mine now.',
      'I meant to do that.',
    ],
    expression: 'smug',
  },
  won_minor: {
    lines: [
      'A tidy little theft.',
      'I like how this is developing.',
    ],
    expression: 'smug',
  },
  won_pawn: {
    lines: [
      'Small snack acquired.',
      'Free crumb.',
    ],
    expression: 'neutral',
  },
};

const MEASURED_PERSONA: ReactionPersona = {
  match_lost: { lines: ['Well played.'], expression: 'frustrated' },
  match_won: { lines: ['Position converted.'], expression: 'smug' },
  lost_queen: { lines: ['That was decisive.'], expression: 'shocked' },
  lost_major: { lines: ['That exchange hurts.'], expression: 'frustrated' },
  lost_minor: { lines: ['Not ideal.'], expression: 'frustrated' },
  lost_pawn: { lines: ['A pawn slips away.'], expression: 'neutral' },
  won_queen: { lines: ['A critical gain.'], expression: 'smug' },
  won_major: { lines: ['Material advantage secured.'], expression: 'smug' },
  won_minor: { lines: ['Pressure rewarded.'], expression: 'neutral' },
  won_pawn: { lines: ['Incremental progress.'], expression: 'neutral' },
};

const GRANDMASTER_PERSONA: ReactionPersona = {
  match_lost: { lines: ['I will revise the line.'], expression: 'frustrated' },
  match_won: { lines: ['That was forced several moves ago.'], expression: 'smug' },
  lost_queen: { lines: ['A catastrophic oversight.'], expression: 'shocked' },
  lost_major: { lines: ['That breaks the position.'], expression: 'frustrated' },
  lost_minor: { lines: ['A tactical concession.'], expression: 'frustrated' },
  lost_pawn: { lines: ['A small but relevant loss.'], expression: 'neutral' },
  won_queen: { lines: ['The evaluation has shifted sharply.'], expression: 'smug' },
  won_major: { lines: ['The position is collapsing for you.'], expression: 'smug' },
  won_minor: { lines: ['A precise extraction.'], expression: 'neutral' },
  won_pawn: { lines: ['Space and material, both improving.'], expression: 'neutral' },
};

const DEFAULT_PERSONA: ReactionPersona = {
  match_lost: { lines: ['You got me this time.'], expression: 'frustrated' },
  match_won: { lines: ['Match concluded in my favor.'], expression: 'smug' },
  lost_queen: { lines: ['That was not the plan.'], expression: 'shocked' },
  lost_major: { lines: ['That was a setback.'], expression: 'frustrated' },
  lost_minor: { lines: ['That piece mattered.'], expression: 'frustrated' },
  lost_pawn: { lines: ['A small loss.'], expression: 'neutral' },
  won_queen: { lines: ['A major swing.'], expression: 'smug' },
  won_major: { lines: ['Advantage acquired.'], expression: 'smug' },
  won_minor: { lines: ['Pressure paid off.'], expression: 'neutral' },
  won_pawn: { lines: ['A small gain.'], expression: 'neutral' },
};

const PERSONAS: Record<string, ReactionPersona> = {
  chick: CHICK_PERSONA,
  measured: MEASURED_PERSONA,
  grandmaster: GRANDMASTER_PERSONA,
  default: DEFAULT_PERSONA,
};

function pickLine(lines: string[], seed: number): string | null {
  return lines[seed % lines.length] ?? null;
}

function classifyCapture(pieceType: PieceType): ReactionEventKey {
  if (pieceType === 'queen') return 'lost_queen';
  if (pieceType === 'rook') return 'lost_major';
  if (pieceType === 'bishop' || pieceType === 'knight') return 'lost_minor';
  return 'lost_pawn';
}

function upgradeToWinEvent(eventKey: ReactionEventKey): ReactionEventKey {
  switch (eventKey) {
    case 'lost_queen':
      return 'won_queen';
    case 'lost_major':
      return 'won_major';
    case 'lost_minor':
      return 'won_minor';
    case 'lost_pawn':
      return 'won_pawn';
    default:
      return 'won_minor';
  }
}

function deriveReactionEvent(input: BotReactionInput): ReactionEventKey | null {
  const { moveRecord, gameStatus } = input;
  const playerMoved = moveRecord.pieceMoved.color === 'white';
  const captured = moveRecord.pieceCaptured;

  if (gameStatus === 'checkmate') {
    return playerMoved ? 'match_lost' : 'match_won';
  }

  if (!captured) return null;
  if (playerMoved && captured.color === 'black') {
    return classifyCapture(captured.type);
  }
  if (!playerMoved && captured.color === 'white') {
    return upgradeToWinEvent(classifyCapture(captured.type));
  }

  return null;
}

export function getSpeakerProfile(speakerId: OpponentId): OpponentProfile {
  const knownBot = BOTS.find(bot => bot.id === speakerId);
  if (knownBot) return knownBot;

  return {
    id: speakerId,
    kind: 'npc',
    icon: '!',
    portraitSlotLabel: 'NPC Portrait',
    dialogueTheme: 'npc',
    name: speakerId.replace(/^npc:/, '').replace(/[-_]/g, ' '),
    tagline: 'Local NPC',
    description: 'Prototype non-player character.',
    difficulty: 0,
    available: true,
    reactionPersonaId: 'default',
  };
}

export function getBotReaction(input: BotReactionInput): BotReactionOutput | null {
  const eventKey = deriveReactionEvent(input);
  if (!eventKey) return null;

  const speaker = getSpeakerProfile(input.speakerId);
  const persona = PERSONAS[speaker.reactionPersonaId] ?? PERSONAS.default;
  const rule = persona[eventKey] ?? PERSONAS.default[eventKey];
  if (!rule) return null;
  const text = pickLine(rule.lines, input.moveIndex);
  if (!text) return null;
  return { text, expression: rule.expression };
}

export function getBotSpeaker(botId: BotId | null): OpponentProfile | null {
  return getBotProfile(botId);
}
