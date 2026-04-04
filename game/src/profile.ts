export interface LocalProfile {
  displayName: string;
  motto: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'pg2-profile';

export function loadProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    if (typeof parsed.displayName !== 'string') return null;

    return {
      displayName: parsed.displayName.trim(),
      motto: typeof parsed.motto === 'string' ? parsed.motto.trim() : '',
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
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
  };

  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}
