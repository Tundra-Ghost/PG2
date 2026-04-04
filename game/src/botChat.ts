import type { MoveRecord } from './engine/types';
import type { BotId } from './components/BotSelect/BotSelect';

export interface BotReactionInput {
  botId: BotId;
  moveRecord: MoveRecord;
  moveIndex: number;
  gameStatus: 'active' | 'checkmate' | 'draw' | 'abandoned' | 'draft';
}

interface ReactionBank {
  lostPiece: string[];
  wonPiece: string[];
  lostQueen: string[];
  playerCheckmate: string[];
  botCheckmate: string[];
}

const CHICK_REACTIONS: ReactionBank = {
  lostPiece: [
    'Hey. That was one of my pieces.',
    'I was using that bird.',
    'Rude. Extremely rude.',
  ],
  wonPiece: [
    'Mine now.',
    'I meant to do that.',
    'That looked expensive.',
  ],
  lostQueen: [
    'That was the important one.',
    'I have made a strategic mistake.',
    'The large bird was not supposed to die.',
  ],
  playerCheckmate: [
    'I would like a rematch with fewer consequences.',
    'This result feels editorialized.',
  ],
  botCheckmate: [
    'Calculated. More or less.',
    'I am the rooftop now.',
  ],
};

const DEFAULT_REACTIONS: ReactionBank = {
  lostPiece: ['That was a setback.'],
  wonPiece: ['Advantage acquired.'],
  lostQueen: ['That was not the plan.'],
  playerCheckmate: ['You got me this time.'],
  botCheckmate: ['Match concluded in my favor.'],
};

function pickLine(lines: string[], seed: number): string | null {
  return lines[seed % lines.length] ?? null;
}

function getReactionBank(botId: BotId): ReactionBank {
  if (botId === 'chick') return CHICK_REACTIONS;
  return DEFAULT_REACTIONS;
}

export function getBotReaction(input: BotReactionInput): string | null {
  const { moveRecord, moveIndex, gameStatus } = input;
  const bank = getReactionBank(input.botId);
  const playerMoved = moveRecord.pieceMoved.color === 'white';
  const captured = moveRecord.pieceCaptured;

  if (gameStatus === 'checkmate') {
    return playerMoved
      ? pickLine(bank.playerCheckmate, moveIndex)
      : pickLine(bank.botCheckmate, moveIndex);
  }

  if (playerMoved && captured?.color === 'black' && captured.type === 'queen') {
    return pickLine(bank.lostQueen, moveIndex);
  }

  if (playerMoved && captured?.color === 'black') {
    return pickLine(bank.lostPiece, moveIndex);
  }

  if (!playerMoved && captured?.color === 'white') {
    return pickLine(bank.wonPiece, moveIndex);
  }

  return null;
}
