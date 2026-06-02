import { getBotProfile, type BotId } from './opponents';
import { createProfile, type LocalProfile } from './profile';

export function buildBotProfile(botId: BotId | null): LocalProfile | null {
  const bot = getBotProfile(botId);
  if (!bot) return null;

  // Prototype-only opponent dossier so in-match profile panels can share
  // the local profile UI without pretending bots are server-backed accounts.
  const base = createProfile({
    displayName: bot.name,
    motto: bot.description,
    region: 'Local Bot Pool',
    country: 'Prototype',
    avatarDataUrl: null,
    selectedTitleId: bot.id === 'chick' ? 'title_bread_bandit' : 'title_rookery_scout',
  });

  return {
    ...base,
    elo: 1200,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    stats: {
      modes: {
        story: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
        quick: {
          gamesPlayed: bot.difficulty * 6,
          wins: bot.difficulty * 2,
          losses: bot.difficulty * 3,
          draws: bot.difficulty,
        },
        online: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
      },
    },
    unlockedAchievements: {
      ach_first_flight: '2026-01-02T00:00:00.000Z',
    },
  };
}
