import { apiCall } from '../../online/account';

/** Admin calls. The server checks the account on every one; a 403 means "not for you". */
export async function adminGet<T>(path: string): Promise<T> {
  const res = await apiCall(`/api/admin${path}`);
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : `request failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiCall(`/api/admin${path}`, { body });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `request failed: ${res.status}`);
  return data;
}
