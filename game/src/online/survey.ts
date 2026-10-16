import { ALL_MODIFIERS, type Color, type GameState } from '@pigeon-chess/game-core';
import { apiCall } from './account';

/**
 * The optional post-game survey. Questions live here, not on the server:
 * each answer carries its question text, so changing a question only needs
 * a client change. Bump SURVEY_ID when the meaning of a question changes.
 */
export const SURVEY_ID = 'post-game-v1';

export type QuestionKind = 'scale' | 'choice' | 'multi' | 'text';

export interface SurveyQuestion {
  id: string;
  kind: QuestionKind;
  prompt: string;
  options?: string[];
  /** Words under the ends of a 1-5 scale. */
  scaleLabels?: [string, string];
  placeholder?: string;
}

export type SurveyAnswerValue = number | string | string[];

export interface GameSurveyContext {
  /** 'local' is two players on one device. */
  mode: 'bot' | 'online' | 'local';
  /** Modifiers that were in play, as ids. */
  modifierIds: string[];
  result: 'win' | 'loss' | 'draw';
  /** Extra details sent with the answers (bot, moves, room...). */
  details: Record<string, unknown>;
}

const modifierName = (id: string) => ALL_MODIFIERS.find(mod => mod.id === id)?.name ?? id;

export function buildPostGameSurvey(context: GameSurveyContext): SurveyQuestion[] {
  const modifiers = [...new Set(context.modifierIds)].map(modifierName);
  const questions: SurveyQuestion[] = [
    { id: 'fun', kind: 'scale', prompt: 'How fun was that game?', scaleLabels: ['Not fun', 'Loved it'] },
  ];
  if (context.mode === 'bot') {
    questions.push({ id: 'bot-difficulty', kind: 'choice', prompt: 'How was the bot?', options: ['Too easy', 'About right', 'Too hard'] });
  } else if (context.mode === 'online') {
    questions.push({ id: 'connection', kind: 'choice', prompt: 'How did the connection feel?', options: ['Smooth', 'A little laggy', 'Broken'] });
  }
  if (modifiers.length > 0) {
    questions.push(
      { id: 'favorite-modifier', kind: 'choice', prompt: 'Favorite modifier this game?', options: [...modifiers, 'None stood out'] },
      { id: 'confusing-modifiers', kind: 'multi', prompt: 'Any modifiers confusing or broken?', options: modifiers },
    );
  }
  questions.push(
    { id: 'play-again', kind: 'choice', prompt: 'Would you play again right now?', options: ['Yes', 'Maybe', 'No'] },
    {
      id: 'issues',
      kind: 'text',
      prompt: 'Did anything break, feel unfair, or confuse you?',
      placeholder: 'What happened? Which move or modifier?',
    },
    { id: 'other', kind: 'text', prompt: 'Anything else?', placeholder: 'Ideas, complaints, praise for Gerald…' },
  );
  return questions;
}

/** Whether a finished game should prompt the survey: real endings only. */
export function isFinished(state: GameState): boolean {
  return state.status === 'checkmate' || state.status === 'draw' || state.status === 'resigned';
}

/** The result from one side's point of view. */
export function resultFor(state: GameState, color: Color): GameSurveyContext['result'] {
  if (state.status === 'draw') return 'draw';
  if (state.status === 'resigned') return state.resignedBy === color ? 'loss' : 'win';
  // Checkmate: the side to move is the one mated.
  return state.turn === color ? 'loss' : 'win';
}

export async function sendSurvey(
  questions: SurveyQuestion[],
  answers: Record<string, SurveyAnswerValue>,
  context: GameSurveyContext,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const answered = questions
    .map(q => ({ id: q.id, kind: q.kind, question: q.prompt, answer: answers[q.id] }))
    .filter(a => a.answer !== undefined && a.answer !== '' && !(Array.isArray(a.answer) && a.answer.length === 0));
  if (answered.length === 0) return { ok: false, reason: 'Answer at least one question, or skip.' };
  try {
    const res = await apiCall('/api/survey', {
      body: {
        survey: SURVEY_ID,
        answers: answered,
        context: {
          mode: context.mode,
          result: context.result,
          modifiers: context.modifierIds,
          ...context.details,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
        },
      },
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, reason: body?.error ?? 'Something went wrong.' };
  } catch {
    return { ok: false, reason: 'Could not reach the game server. Try again in a moment.' };
  }
}
