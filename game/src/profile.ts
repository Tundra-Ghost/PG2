export interface LocalProfileStats {
  runsPlayed: number;
  wins: number;
  favoriteModifierId: string | null;
  modifierUsage: Record<string, number>;
}

export interface LocalProfile {
  displayName: string;
  motto: string;
  createdAt: string;
  updatedAt: string;
  stats: LocalProfileStats;
}

const KEY = 'pg2-profile';

function buildDefaultStats(): LocalProfileStats {
  return {
    runsPlayed: 0,
    wins: 0,
    favoriteModifierId: null,
    modifierUsage: {},
  };
}

function resolveFavoriteModifierId(modifierUsage: Record<string, number>): string | null {
  const ranked = Object.entries(modifierUsage).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return ranked[0]?.[0] ?? null;
}

function normalizeProfile(parsed: Partial<LocalProfile>): LocalProfile | null {
  if (typeof parsed.displayName !== 'string') return null;

  const modifierUsage =
    parsed.stats && typeof parsed.stats === 'object' && parsed.stats.modifierUsage
      ? parsed.stats.modifierUsage
      : {};

  const stats: LocalProfileStats = {
    runsPlayed:
      parsed.stats && typeof parsed.stats.runsPlayed === 'number'
        ? parsed.stats.runsPlayed
        : 0,
    wins:
      parsed.stats && typeof parsed.stats.wins === 'number'
        ? parsed.stats.wins
        : 0,
    favoriteModifierId:
      parsed.stats && typeof parsed.stats.favoriteModifierId === 'string'
        ? parsed.stats.favoriteModifierId
        : resolveFavoriteModifierId(modifierUsage),
    modifierUsage,
  };

  return {
    displayName: parsed.displayName.trim(),
    motto: typeof parsed.motto === 'string' ? parsed.motto.trim() : '',
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    stats,
  };
}

function persistProfile(profile: LocalProfile): LocalProfile {
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

export function loadProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeProfile(JSON.parse(raw) as Partial<LocalProfile>);
  } catch {
    return null;
  }
}

export function saveProfile(input: { displayName: string; motto: string }): LocalProfile {
  const existing = loadProfile();
  const now = new Date().toISOString();
  const profile: LocalProfile = {
    displayName: input.displayName.trim(),
    motto: input.motto.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    stats: existing?.stats ?? buildDefaultStats(),
  };

  return persistProfile(profile);
}

export function recordProfileRun(
  current: LocalProfile,
  modifierIds: string[],
): LocalProfile {
  const modifierUsage = { ...current.stats.modifierUsage };
  for (const id of modifierIds) {
    modifierUsage[id] = (modifierUsage[id] ?? 0) + 1;
  }

  const next: LocalProfile = {
    ...current,
    updatedAt: new Date().toISOString(),
    stats: {
      runsPlayed: current.stats.runsPlayed + 1,
      wins: current.stats.wins,
      modifierUsage,
      favoriteModifierId: resolveFavoriteModifierId(modifierUsage),
    },
  };

  return persistProfile(next);
}

export function recordProfileWin(current: LocalProfile): LocalProfile {
  const next: LocalProfile = {
    ...current,
    updatedAt: new Date().toISOString(),
    stats: {
      ...current.stats,
      wins: current.stats.wins + 1,
    },
  };

  return persistProfile(next);
}
