import type { MoveRecord, PieceType } from './engine/types';
import { BOTS, getBotProfile, type BotId, type OpponentId, type OpponentProfile } from './opponents';

export interface BotReactionInput {
  speakerId: OpponentId;
  moveRecord: MoveRecord;
  moveIndex: number;
  gameStatus: 'active' | 'checkmate' | 'draw' | 'abandoned' | 'draft';
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

type ReactionPersona = Partial<Record<ReactionEventKey, string[]>>;

const CHICK_PERSONA: ReactionPersona = {
  match_lost: [
    'I would like a rematch with fewer consequences.',
    'This result feels editorialized.',
  ],
  match_won: [
    'Calculated. More or less.',
    'I am the rooftop now.',
  ],
  lost_queen: [
    'That was the important one.',
    'I have made a strategic mistake.',
    'The large bird was not supposed to die.',
  ],
  lost_major: [
    'Hey. That was one of my serious pieces.',
    'That one had a union contract.',
  ],
  lost_minor: [
    'I was using that bird.',
    'Rude. Extremely rude.',
  ],
  lost_pawn: [
    'Acceptable losses. Probably.',
    'That chick was a volunteer.',
  ],
  won_queen: [
    'That looked expensive.',
    'I have captured the large bird.',
  ],
  won_major: [
    'Mine now.',
    'I meant to do that.',
  ],
  won_minor: [
    'A tidy little theft.',
    'I like how this is developing.',
  ],
  won_pawn: [
    'Small snack acquired.',
    'Free crumb.',
  ],
};

const MEASURED_PERSONA: ReactionPersona = {
  match_lost: ['Well played.'],
  match_won: ['Position converted.'],
  lost_queen: ['That was decisive.'],
  lost_major: ['That exchange hurts.'],
  lost_minor: ['Not ideal.'],
  lost_pawn: ['A pawn slips away.'],
  won_queen: ['A critical gain.'],
  won_major: ['Material advantage secured.'],
  won_minor: ['Pressure rewarded.'],
  won_pawn: ['Incremental progress.'],
};

const GRANDMASTER_PERSONA: ReactionPersona = {
  match_lost: ['I will revise the line.'],
  match_won: ['That was forced several moves ago.'],
  lost_queen: ['A catastrophic oversight.'],
  lost_major: ['That breaks the position.'],
  lost_minor: ['A tactical concession.'],
  lost_pawn: ['A small but relevant loss.'],
  won_queen: ['The evaluation has shifted sharply.'],
  won_major: ['The position is collapsing for you.'],
  won_minor: ['A precise extraction.'],
  won_pawn: ['Space and material, both improving.'],
};

const DEFAULT_PERSONA: ReactionPersona = {
  match_lost: ['You got me this time.'],
  match_won: ['Match concluded in my favor.'],
  lost_queen: ['That was not the plan.'],
  lost_major: ['That was a setback.'],
  lost_minor: ['That piece mattered.'],
  lost_pawn: ['A small loss.'],
  won_queen: ['A major swing.'],
  won_major: ['Advantage acquired.'],
  won_minor: ['Pressure paid off.'],
  won_pawn: ['A small gain.'],
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
    name: speakerId.replace(/^npc:/, '').replace(/[-_]/g, ' '),
    tagline: 'Local NPC',
    description: 'Prototype non-player character.',
    difficulty: 0,
    available: true,
    reactionPersonaId: 'default',
  };
}

export function getBotReaction(input: BotReactionInput): string | null {
  const eventKey = deriveReactionEvent(input);
  if (!eventKey) return null;

  const speaker = getSpeakerProfile(input.speakerId);
  const persona = PERSONAS[speaker.reactionPersonaId] ?? PERSONAS.default;
  const lines = persona[eventKey] ?? PERSONAS.default[eventKey] ?? [];
  return pickLine(lines, input.moveIndex);
}

export function getBotSpeaker(botId: BotId | null): OpponentProfile | null {
  return getBotProfile(botId);
}
