export type MatchMode = 'story' | 'quick' | 'online';
export type MatchResult = 'win' | 'loss' | 'draw';
export type MatchOutcome = 'checkmate' | 'draw' | 'abandoned';

export interface ModeStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface MatchRecord {
  id: string;
  playedAt: string;
  mode: MatchMode;
  opponentName: string;
  opponentType: 'bot' | 'player';
  result: MatchResult;
  outcome: MatchOutcome;
  moveCount: number;
  draftedModifierIds: string[];
}

export interface LocalProfileStats {
  modes: Record<MatchMode, ModeStats>;
}

export interface LocalProfile {
  displayName: string;
  motto: string;
  region: string;
  country: string;
  avatarDataUrl: string | null;
  selectedTitleId: string;
  elo: number;
  createdAt: string;
  updatedAt: string;
  stats: LocalProfileStats;
  matchHistory: MatchRecord[];
  unlockedAchievements: Record<string, string>;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: 'career' | 'victory' | 'modifier' | 'journey';
}

export interface TitleDefinition {
  id: string;
  name: string;
  unlockText: string;
  unlock:
    | { type: 'starter' }
    | { type: 'level'; level: number }
    | { type: 'elo'; elo: number }
    | { type: 'achievement'; achievementId: string };
}

interface ProfileInput {
  displayName: string;
  motto: string;
  region: string;
  country: string;
  avatarDataUrl: string | null;
  selectedTitleId: string;
}

interface MatchCompletionInput {
  matchId: string;
  playedAt: string;
  mode: MatchMode;
  opponentName: string;
  opponentType: 'bot' | 'player';
  result: MatchResult;
  outcome: MatchOutcome;
  moveCount: number;
  draftedModifierIds: string[];
}

const KEY = 'pg2-profile';
const STARTING_ELO = 1200;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'ach_first_flight',
    name: 'First Flight',
    description: 'Play your first recorded match in Pigeon Chess.',
    category: 'career',
  },
  {
    id: 'ach_first_win',
    name: 'First Crumb',
    description: 'Win your first recorded match.',
    category: 'victory',
  },
  {
    id: 'ach_story_runner',
    name: 'Tower Walker',
    description: 'Play 5 Story matches.',
    category: 'journey',
  },
  {
    id: 'ach_quick_draw',
    name: 'Lunch Break Tactician',
    description: 'Play 5 Quick matches.',
    category: 'journey',
  },
  {
    id: 'ach_ten_games',
    name: 'Seasoned Forager',
    description: 'Reach 10 total games played.',
    category: 'career',
  },
  {
    id: 'ach_three_wins',
    name: 'Bread Winner',
    description: 'Earn 3 wins in any mode.',
    category: 'victory',
  },
  {
    id: 'ach_modifier_drafter',
    name: 'Chaos Courier',
    description: 'Draft modifiers in 3 separate matches.',
    category: 'modifier',
  },
  {
    id: 'ach_returning_pigeon',
    name: 'Returning Pigeon',
    description: 'Stay on Pigeon Chess for 7 days.',
    category: 'journey',
  },
];

export const TITLE_DEFINITIONS: TitleDefinition[] = [
  { id: 'title_street_pigeon', name: 'Street Pigeon', unlockText: 'Starter title', unlock: { type: 'starter' } },
  { id: 'title_rookery_scout', name: 'Rookery Scout', unlockText: 'Starter title', unlock: { type: 'starter' } },
  { id: 'title_bread_bandit', name: 'Bread Bandit', unlockText: 'Starter title', unlock: { type: 'starter' } },
  { id: 'title_park_regular', name: 'Park Regular', unlockText: 'Starter title', unlock: { type: 'starter' } },
  { id: 'title_rooftop_rival', name: 'Rooftop Rival', unlockText: 'Reach level 4', unlock: { type: 'level', level: 4 } },
  { id: 'title_clocktower_keeper', name: 'Clocktower Keeper', unlockText: 'Reach level 7', unlock: { type: 'level', level: 7 } },
  { id: 'title_skyline_tactician', name: 'Skyline Tactician', unlockText: 'Reach level 10', unlock: { type: 'level', level: 10 } },
  { id: 'title_ladder_climber', name: 'Ladder Climber', unlockText: 'Reach 1400 ELO', unlock: { type: 'elo', elo: 1400 } },
  { id: 'title_city_master', name: 'City Master', unlockText: 'Reach 1600 ELO', unlock: { type: 'elo', elo: 1600 } },
  { id: 'title_crumb_conqueror', name: 'Crumb Conqueror', unlockText: 'Unlock First Crumb', unlock: { type: 'achievement', achievementId: 'ach_first_win' } },
  { id: 'title_chaos_curator', name: 'Chaos Curator', unlockText: 'Unlock Chaos Courier', unlock: { type: 'achievement', achievementId: 'ach_modifier_drafter' } },
  { id: 'title_seasoned_forager', name: 'Seasoned Forager', unlockText: 'Unlock Seasoned Forager', unlock: { type: 'achievement', achievementId: 'ach_ten_games' } },
];

function buildEmptyModeStats(): ModeStats {
  return { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
}

function buildDefaultProfileStats(): LocalProfileStats {
  return {
    modes: {
      story: buildEmptyModeStats(),
      quick: buildEmptyModeStats(),
      online: buildEmptyModeStats(),
    },
  };
}

function normalizeMatchHistory(records: unknown): MatchRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record): record is MatchRecord => {
      return (
        typeof record === 'object' &&
        record !== null &&
        typeof (record as MatchRecord).id === 'string' &&
        typeof (record as MatchRecord).mode === 'string'
      );
    })
    .map(record => ({
      ...record,
      draftedModifierIds: Array.isArray(record.draftedModifierIds) ? record.draftedModifierIds : [],
    }));
}

function normalizeModeStats(value: unknown): Record<MatchMode, ModeStats> {
  const source = typeof value === 'object' && value !== null ? value as Partial<Record<MatchMode, Partial<ModeStats>>> : {};
  return {
    story: {
      gamesPlayed: source.story?.gamesPlayed ?? 0,
      wins: source.story?.wins ?? 0,
      losses: source.story?.losses ?? 0,
      draws: source.story?.draws ?? 0,
    },
    quick: {
      gamesPlayed: source.quick?.gamesPlayed ?? 0,
      wins: source.quick?.wins ?? 0,
      losses: source.quick?.losses ?? 0,
      draws: source.quick?.draws ?? 0,
    },
    online: {
      gamesPlayed: source.online?.gamesPlayed ?? 0,
      wins: source.online?.wins ?? 0,
      losses: source.online?.losses ?? 0,
      draws: source.online?.draws ?? 0,
    },
  };
}

function persistProfile(profile: LocalProfile): LocalProfile {
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

function normalizeProfile(parsed: Partial<LocalProfile>): LocalProfile | null {
  if (typeof parsed.displayName !== 'string') return null;

  const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString();
  const matchHistory = normalizeMatchHistory(parsed.matchHistory);
  const profile: LocalProfile = {
    displayName: parsed.displayName.trim(),
    motto: typeof parsed.motto === 'string' ? parsed.motto.trim() : '',
    region: typeof parsed.region === 'string' ? parsed.region : 'North America',
    country: typeof parsed.country === 'string' ? parsed.country : '',
    avatarDataUrl: typeof parsed.avatarDataUrl === 'string' ? parsed.avatarDataUrl : null,
    selectedTitleId: typeof parsed.selectedTitleId === 'string' ? parsed.selectedTitleId : 'title_street_pigeon',
    elo: typeof parsed.elo === 'number' ? parsed.elo : STARTING_ELO,
    createdAt,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    stats: {
      modes: normalizeModeStats(parsed.stats && typeof parsed.stats === 'object' ? parsed.stats.modes : undefined),
    },
    matchHistory,
    unlockedAchievements:
      parsed.unlockedAchievements && typeof parsed.unlockedAchievements === 'object'
        ? parsed.unlockedAchievements
        : {},
  };

  const unlockedTitles = getUnlockedTitles(profile).map(title => title.id);
  if (!unlockedTitles.includes(profile.selectedTitleId)) {
    profile.selectedTitleId = unlockedTitles[0] ?? 'title_street_pigeon';
  }

  return ensureAchievementUnlocks(profile);
}

export function loadProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const normalized = normalizeProfile(JSON.parse(raw) as Partial<LocalProfile>);
    if (!normalized) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function createProfile(input?: Partial<ProfileInput>): LocalProfile {
  const now = new Date().toISOString();
  return {
    displayName: input?.displayName?.trim() || 'Player',
    motto: input?.motto?.trim() || '',
    region: input?.region || 'North America',
    country: input?.country || '',
    avatarDataUrl: input?.avatarDataUrl ?? null,
    selectedTitleId: input?.selectedTitleId || 'title_street_pigeon',
    elo: STARTING_ELO,
    createdAt: now,
    updatedAt: now,
    stats: buildDefaultProfileStats(),
    matchHistory: [],
    unlockedAchievements: {},
  };
}

export function saveProfile(input: ProfileInput): LocalProfile {
  const existing = loadProfile();
  const next = createProfile({
    displayName: input.displayName,
    motto: input.motto,
    region: input.region,
    country: input.country,
    avatarDataUrl: input.avatarDataUrl,
    selectedTitleId: input.selectedTitleId,
  });

  const merged: LocalProfile = {
    ...next,
    createdAt: existing?.createdAt ?? next.createdAt,
    updatedAt: new Date().toISOString(),
    elo: existing?.elo ?? next.elo,
    stats: existing?.stats ?? next.stats,
    matchHistory: existing?.matchHistory ?? next.matchHistory,
    unlockedAchievements: existing?.unlockedAchievements ?? next.unlockedAchievements,
  };

  return persistProfile(ensureAchievementUnlocks(merged));
}

export function updateProfile(current: LocalProfile, patch: Partial<ProfileInput>): LocalProfile {
  const candidate: LocalProfile = {
    ...current,
    displayName: patch.displayName?.trim() ?? current.displayName,
    motto: patch.motto?.trim() ?? current.motto,
    region: patch.region ?? current.region,
    country: patch.country ?? current.country,
    avatarDataUrl:
      patch.avatarDataUrl === undefined ? current.avatarDataUrl : patch.avatarDataUrl,
    selectedTitleId: patch.selectedTitleId ?? current.selectedTitleId,
    updatedAt: new Date().toISOString(),
  };

  const unlockedTitles = getUnlockedTitles(candidate).map(title => title.id);
  if (!unlockedTitles.includes(candidate.selectedTitleId)) {
    candidate.selectedTitleId = unlockedTitles[0] ?? 'title_street_pigeon';
  }

  return persistProfile(ensureAchievementUnlocks(candidate));
}

export function recordProfileMatchStart(current: LocalProfile, mode: MatchMode): LocalProfile {
  const next: LocalProfile = {
    ...current,
    updatedAt: new Date().toISOString(),
    stats: {
      modes: {
        ...current.stats.modes,
        [mode]: {
          ...current.stats.modes[mode],
          gamesPlayed: current.stats.modes[mode].gamesPlayed + 1,
        },
      },
    },
  };

  return persistProfile(ensureAchievementUnlocks(next));
}

export function recordProfileMatchCompletion(
  current: LocalProfile,
  input: MatchCompletionInput,
): LocalProfile {
  const modeStats = current.stats.modes[input.mode];
  const updatedModeStats: ModeStats = {
    ...modeStats,
    wins: modeStats.wins + (input.result === 'win' ? 1 : 0),
    losses: modeStats.losses + (input.result === 'loss' ? 1 : 0),
    draws: modeStats.draws + (input.result === 'draw' ? 1 : 0),
  };

  const next: LocalProfile = {
    ...current,
    updatedAt: new Date().toISOString(),
    stats: {
      modes: {
        ...current.stats.modes,
        [input.mode]: updatedModeStats,
      },
    },
    matchHistory: [
      {
        id: input.matchId,
        playedAt: input.playedAt,
        mode: input.mode,
        opponentName: input.opponentName,
        opponentType: input.opponentType,
        result: input.result,
        outcome: input.outcome,
        moveCount: input.moveCount,
        draftedModifierIds: input.draftedModifierIds,
      },
      ...current.matchHistory,
    ].slice(0, 100),
  };

  return persistProfile(ensureAchievementUnlocks(next));
}

function getTotalWins(profile: LocalProfile): number {
  return profile.stats.modes.story.wins + profile.stats.modes.quick.wins + profile.stats.modes.online.wins;
}

function getTotalGames(profile: LocalProfile): number {
  return profile.stats.modes.story.gamesPlayed +
    profile.stats.modes.quick.gamesPlayed +
    profile.stats.modes.online.gamesPlayed;
}

export function getDaysOnPigeonChess(profile: LocalProfile): number {
  const createdAt = new Date(profile.createdAt).getTime();
  const now = Date.now();
  const elapsed = Math.max(0, now - createdAt);
  return Math.max(1, Math.floor(elapsed / 86400000) + 1);
}

export function getProfileLevel(profile: LocalProfile): number {
  const totalGames = getTotalGames(profile);
  const totalWins = getTotalWins(profile);
  const achievementCount = Object.keys(profile.unlockedAchievements).length;
  const provisionalXp = totalGames * 80 + totalWins * 140 + achievementCount * 60;
  return Math.max(1, Math.floor(provisionalXp / 220) + 1);
}

export function getTotalModeStats(profile: LocalProfile): ModeStats {
  return {
    gamesPlayed: getTotalGames(profile),
    wins: getTotalWins(profile),
    losses:
      profile.stats.modes.story.losses +
      profile.stats.modes.quick.losses +
      profile.stats.modes.online.losses,
    draws:
      profile.stats.modes.story.draws +
      profile.stats.modes.quick.draws +
      profile.stats.modes.online.draws,
  };
}

export function getFavoriteModifiers(profile: LocalProfile, scope: 'all' | 'recent'): string[] {
  const counts = new Map<string, number>();
  const source =
    scope === 'recent'
      ? profile.matchHistory.slice(0, 10)
      : profile.matchHistory;

  for (const record of source) {
    for (const modifierId of record.draftedModifierIds) {
      counts.set(modifierId, (counts.get(modifierId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 3)
    .map(entry => entry[0]);
}

function ensureAchievementUnlocks(profile: LocalProfile): LocalProfile {
  const unlockedAchievements = { ...profile.unlockedAchievements };
  const totalGames = getTotalGames(profile);
  const totalWins = getTotalWins(profile);
  const storyGames = profile.stats.modes.story.gamesPlayed;
  const quickGames = profile.stats.modes.quick.gamesPlayed;
  const draftedMatches = profile.matchHistory.filter(match => match.draftedModifierIds.length > 0).length;
  const daysOn = getDaysOnPigeonChess(profile);
  const now = new Date().toISOString();

  const unlock = (achievementId: string) => {
    if (!unlockedAchievements[achievementId]) unlockedAchievements[achievementId] = now;
  };

  if (totalGames >= 1) unlock('ach_first_flight');
  if (totalWins >= 1) unlock('ach_first_win');
  if (storyGames >= 5) unlock('ach_story_runner');
  if (quickGames >= 5) unlock('ach_quick_draw');
  if (totalGames >= 10) unlock('ach_ten_games');
  if (totalWins >= 3) unlock('ach_three_wins');
  if (draftedMatches >= 3) unlock('ach_modifier_drafter');
  if (daysOn >= 7) unlock('ach_returning_pigeon');

  return { ...profile, unlockedAchievements };
}

export function getUnlockedTitles(profile: LocalProfile): TitleDefinition[] {
  const level = getProfileLevel(profile);
  return TITLE_DEFINITIONS.filter(title => {
    if (title.unlock.type === 'starter') return true;
    if (title.unlock.type === 'level') return level >= title.unlock.level;
    if (title.unlock.type === 'elo') return profile.elo >= title.unlock.elo;
    return Boolean(profile.unlockedAchievements[title.unlock.achievementId]);
  });
}

export function getLockedTitles(profile: LocalProfile): TitleDefinition[] {
  const unlockedIds = new Set(getUnlockedTitles(profile).map(title => title.id));
  return TITLE_DEFINITIONS.filter(title => !unlockedIds.has(title.id));
}

export function getSelectedTitle(profile: LocalProfile): TitleDefinition {
  return (
    TITLE_DEFINITIONS.find(title => title.id === profile.selectedTitleId) ??
    TITLE_DEFINITIONS[0]
  );
}

export function getAchievementCompletion(profile: LocalProfile): {
  unlocked: AchievementDefinition[];
  locked: AchievementDefinition[];
} {
  const unlocked = ACHIEVEMENTS.filter(item => profile.unlockedAchievements[item.id]);
  const locked = ACHIEVEMENTS.filter(item => !profile.unlockedAchievements[item.id]);
  return { unlocked, locked };
}

export function getWinRate(stats: ModeStats): number {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 100);
}
