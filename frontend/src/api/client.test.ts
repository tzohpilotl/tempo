import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth, projects, tracking, ApiError } from './client';
import { isNetworkFailing, reportNetworkSuccess } from '../utils/networkStatus';

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: async () => body,
  } as Response;
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    reportNetworkSuccess(); // reset the module-level singleton between tests
  });

  it('returns the parsed response on a successful GET', async () => {
    const data = [{ project_id: '1', name: 'Tempo', user_id: 'u1', created_at: 'now' }];
    vi.mocked(fetch).mockResolvedValue(jsonResponse(data));

    await expect(projects.list()).resolves.toEqual(data);
  });

  it('falls back to the cached response when a GET fails at the network level', async () => {
    const data = [{ project_id: '1', name: 'Tempo', user_id: 'u1', created_at: 'now' }];
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(data));
    await projects.list(); // primes the cache for GET /projects

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(projects.list()).resolves.toEqual(data);
  });

  it('rethrows a network failure when nothing is cached for that request yet', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(projects.stats()).rejects.toThrow('Failed to fetch');
  });

  it('does not fall back to cache for a reachable-but-erroring response, even with a cached value', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ user_id: 'u1' }));
    await auth.me(); // primes the cache for GET /auth/me

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, { status: 401 }));
    await expect(auth.me()).rejects.toMatchObject(new ApiError(401, 'Unauthorized'));
  });

  it('caches independently per distinct request path', async () => {
    const page1 = { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
    const page2 = { data: [], total: 0, page: 2, pageSize: 20, totalPages: 1 };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page1));
    await tracking.list({ page: 1 });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page2));
    await tracking.list({ page: 2 });

    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(tracking.list({ page: 1 })).resolves.toEqual(page1);
    await expect(tracking.list({ page: 2 })).resolves.toEqual(page2);
  });

  it('does not attempt a cache fallback for a failed write', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(projects.create('New project')).rejects.toThrow('Failed to fetch');
  });

  it('treats a 204 No Content response as undefined', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(undefined, { status: 204 }));
    await expect(projects.delete('1')).resolves.toBeUndefined();
  });

  it('marks the network as failing on a network-level failure, regardless of method', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await projects.create('New project').catch(() => {});
    expect(isNetworkFailing()).toBe(true);
  });

  it('clears a failing network state on any response that reaches the server, even an error one', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await projects.stats().catch(() => {});
    expect(isNetworkFailing()).toBe(true);

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, { status: 401 }));
    await auth.me().catch(() => {});
    expect(isNetworkFailing()).toBe(false);
  });
});
