import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiCall } from './account';

afterEach(() => vi.unstubAllGlobals());

describe('apiCall', () => {
  it('waits for a sleeping server to wake, then sends again', async () => {
    const urls: string[] = [];
    let sends = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      if (url.endsWith('/health')) return new Response('{"ok":true}', { status: 200 });
      sends += 1;
      // The first try finds the server asleep: Fly's proxy answers 503.
      return new Response('{}', { status: sends === 1 ? 503 : 200 });
    });

    const res = await apiCall('/api/profile');

    expect(res.status).toBe(200);
    expect(urls.map(url => url.replace(/^.*\/\/[^/]+/, ''))).toEqual(['/api/profile', '/health', '/api/profile']);
  });

  it('does not retry an answer from the app itself', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await apiCall('/api/profile');

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
