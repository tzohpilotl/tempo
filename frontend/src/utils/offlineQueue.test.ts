import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueEventCreate, getPendingEvents, drainQueue } from './offlineQueue';
import { ApiError } from '../api/client';

async function clearQueue(): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('tempo-offline-queue', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('pending_events', 'readwrite');
    tx.objectStore('pending_events').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('offlineQueue', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it('returns an optimistic event with a local id', async () => {
    const event = await queueEventCreate({
      started_at: '2026-01-01T10:00:00.000Z',
      stopped_at: '2026-01-01T10:30:00.000Z',
      task_description: 'Offline work',
    });

    expect(event.tracking_event_id).toMatch(/^local-/);
    expect(event.duration_seconds).toBe(1800);
    expect(event.task_description).toBe('Offline work');
  });

  it('getPendingEvents includes a queued event not yet synced', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-01T10:00:00.000Z',
      stopped_at: '2026-01-01T10:15:00.000Z',
    });

    const pending = await getPendingEvents();
    expect(pending.map((e) => e.tracking_event_id)).toContain(queued.tracking_event_id);
  });

  it('drainQueue syncs a queued event via the injected request function and removes it from the queue', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-02T10:00:00.000Z',
      stopped_at: '2026-01-02T10:15:00.000Z',
    });

    const requestFn = vi.fn().mockResolvedValue({
      tracking_event_id: 'server-1',
      started_at: '2026-01-02T10:00:00.000Z',
      stopped_at: '2026-01-02T10:15:00.000Z',
      duration_seconds: 900,
      task_description: null,
      project: null,
    });

    await drainQueue(requestFn);

    expect(requestFn).toHaveBeenCalledWith(
      '/tracking',
      expect.objectContaining({ method: 'POST' }),
    );
    const pending = await getPendingEvents();
    expect(pending.map((e) => e.tracking_event_id)).not.toContain(queued.tracking_event_id);
  });

  it('stops draining and leaves the item queued on a real rejection', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-03T10:00:00.000Z',
      stopped_at: '2026-01-03T10:15:00.000Z',
    });

    const requestFn = vi.fn().mockRejectedValue(new ApiError(409, 'This session overlaps an existing one'));

    await drainQueue(requestFn);

    const pending = await getPendingEvents();
    expect(pending.map((e) => e.tracking_event_id)).toContain(queued.tracking_event_id);
  });

  it('stops draining silently on a renewed network failure, leaving the item queued', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-04T10:00:00.000Z',
      stopped_at: '2026-01-04T10:15:00.000Z',
    });

    const requestFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await drainQueue(requestFn);

    const pending = await getPendingEvents();
    expect(pending.map((e) => e.tracking_event_id)).toContain(queued.tracking_event_id);
  });
});
