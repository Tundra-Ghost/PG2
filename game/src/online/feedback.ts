import { apiCall } from './account';

export type FeedbackKind = 'bug' | 'idea' | 'other';

/** Sends feedback to the game server. Signed-in players' usernames are attached by the server. */
export async function sendFeedback(
  kind: FeedbackKind,
  message: string,
  context: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await apiCall('/api/feedback', { body: { kind, message, context } });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, reason: body?.error ?? 'Something went wrong.' };
  } catch {
    return { ok: false, reason: 'Could not reach the game server. Try again in a moment.' };
  }
}
