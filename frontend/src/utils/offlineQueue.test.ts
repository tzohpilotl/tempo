import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  queueEventCreate,
  queueEventUpdate,
  queueEventDelete,
  getPendingCreates,
  getPendingChanges,
  applyPendingChanges,
  drainQueue,
} from './offlineQueue';
import { ApiError } from '../api/client';
import type { TrackingEvent } from '../types';

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

const syncedEvent = (overrides: Partial<TrackingEvent> = {}): TrackingEvent => ({
  tracking_event_id: 'server-1',
  started_at: '2026-01-02T10:00:00.000Z',
  stopped_at: '2026-01-02T10:15:00.000Z',
  duration_seconds: 900,
  task_description: 'Original',
  project: null,
  ...overrides,
});

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

  it('getPendingCreates includes a queued event not yet synced', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-01T10:00:00.000Z',
      stopped_at: '2026-01-01T10:15:00.000Z',
    });

    const pending = await getPendingCreates();
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
    const pending = await getPendingCreates();
    expect(pending.map((e) => e.tracking_event_id)).not.toContain(queued.tracking_event_id);
  });

  it('stops draining and leaves the item queued on a real rejection', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-03T10:00:00.000Z',
      stopped_at: '2026-01-03T10:15:00.000Z',
    });

    const requestFn = vi.fn().mockRejectedValue(new ApiError(409, 'This session overlaps an existing one'));

    await drainQueue(requestFn);

    const pending = await getPendingCreates();
    expect(pending.map((e) => e.tracking_event_id)).toContain(queued.tracking_event_id);
  });

  it('stops draining silently on a renewed network failure, leaving the item queued', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-04T10:00:00.000Z',
      stopped_at: '2026-01-04T10:15:00.000Z',
    });

    const requestFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await drainQueue(requestFn);

    const pending = await getPendingCreates();
    expect(pending.map((e) => e.tracking_event_id)).toContain(queued.tracking_event_id);
  });

  it('queueEventUpdate on a still-queued local creation folds the edit into the create, without adding a separate op', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-05T10:00:00.000Z',
      stopped_at: '2026-01-05T10:15:00.000Z',
      task_description: 'Original',
    });

    const updated = await queueEventUpdate(queued.tracking_event_id, {
      started_at: '2026-01-05T10:00:00.000Z',
      stopped_at: '2026-01-05T10:30:00.000Z',
      task_description: 'Edited',
    });

    expect(updated.tracking_event_id).toBe(queued.tracking_event_id);
    expect(updated.task_description).toBe('Edited');
    expect(updated.duration_seconds).toBe(1800);

    const pending = await getPendingCreates();
    expect(pending).toHaveLength(1);
    expect(pending[0].task_description).toBe('Edited');
  });

  it('queueEventUpdate on a real synced id queues an update op that drainQueue PATCHes', async () => {
    const updated = await queueEventUpdate('server-1', {
      started_at: '2026-01-06T10:00:00.000Z',
      stopped_at: '2026-01-06T11:00:00.000Z',
      task_description: 'Edited offline',
    });
    expect(updated.tracking_event_id).toBe('server-1');

    const pending = await getPendingChanges();
    expect(pending.updates.get('server-1')?.task_description).toBe('Edited offline');

    const requestFn = vi.fn().mockResolvedValue(updated);
    await drainQueue(requestFn);

    expect(requestFn).toHaveBeenCalledWith(
      '/tracking/server-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect((await getPendingChanges()).updates.has('server-1')).toBe(false);
  });

  it('a second queued edit to the same synced event replaces the first rather than stacking', async () => {
    await queueEventUpdate('server-1', {
      started_at: '2026-01-06T10:00:00.000Z',
      stopped_at: '2026-01-06T11:00:00.000Z',
      task_description: 'First edit',
    });
    await queueEventUpdate('server-1', {
      started_at: '2026-01-06T10:00:00.000Z',
      stopped_at: '2026-01-06T11:00:00.000Z',
      task_description: 'Second edit',
    });

    const pending = await getPendingChanges();
    expect(pending.updates.get('server-1')?.task_description).toBe('Second edit');

    const requestFn = vi.fn().mockResolvedValue({});
    await drainQueue(requestFn);
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it('queueEventDelete on a still-queued local creation drops it entirely — nothing to sync', async () => {
    const queued = await queueEventCreate({
      started_at: '2026-01-07T10:00:00.000Z',
      stopped_at: '2026-01-07T10:15:00.000Z',
    });

    await queueEventDelete(queued.tracking_event_id);

    const pending = await getPendingCreates();
    expect(pending).toHaveLength(0);

    const requestFn = vi.fn();
    await drainQueue(requestFn);
    expect(requestFn).not.toHaveBeenCalled();
  });

  it('queueEventDelete on a real synced id drops any queued update for it and queues a delete op that drainQueue DELETEs', async () => {
    await queueEventUpdate('server-2', {
      started_at: '2026-01-08T10:00:00.000Z',
      stopped_at: '2026-01-08T10:15:00.000Z',
    });
    await queueEventDelete('server-2');

    const pending = await getPendingChanges();
    expect(pending.updates.has('server-2')).toBe(false);
    expect(pending.deletes.has('server-2')).toBe(true);

    const requestFn = vi.fn().mockResolvedValue(undefined);
    await drainQueue(requestFn);

    expect(requestFn).toHaveBeenCalledWith('/tracking/server-2', expect.objectContaining({ method: 'DELETE' }));
    expect((await getPendingChanges()).deletes.has('server-2')).toBe(false);
  });

  it('applyPendingChanges filters deleted events and patches edited ones', async () => {
    await queueEventDelete('server-1');
    await queueEventUpdate('server-2', {
      started_at: '2026-01-09T10:00:00.000Z',
      stopped_at: '2026-01-09T11:00:00.000Z',
      task_description: 'Patched',
    });

    const pending = await getPendingChanges();
    const events = [syncedEvent({ tracking_event_id: 'server-1' }), syncedEvent({ tracking_event_id: 'server-2' })];
    const result = applyPendingChanges(events, pending, []);

    expect(result.map((e) => e.tracking_event_id)).toEqual(['server-2']);
    expect(result[0].task_description).toBe('Patched');
    expect(result[0].duration_seconds).toBe(3600);
  });
});
