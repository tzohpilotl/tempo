import { useSyncExternalStore } from 'react';
import type { Project, TrackingEvent } from '../types';
import { ApiError } from '../api/client';
import { OfflineCache, offlineCache } from './offlineCache';
import { logError } from './logger';

/** Matches api/client.ts's request() shape — passed into drain() rather than imported, so this module never depends on client.ts's implementation, only on ApiError for conflict detection. */
export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

const DB_NAME = 'tempo-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_events';

export interface QueuedEventPayload {
  started_at: string;
  stopped_at: string;
  task_description?: string;
  project_id?: string;
}

/**
 * A create carries the full payload for a not-yet-synced event, keyed by its
 * own local id (also the optimistic event's id). An update/delete targets an
 * already-synced event by its real server id.
 *
 * Edits or deletes of an event that is itself still a queued create (a
 * Phase 2 local-<uuid> id) never produce their own 'update'/'delete' entry —
 * they're folded straight into the 'create' entry instead (see
 * enqueueUpdate/enqueueDelete below), since there's nothing on the server yet
 * to target. So by the time drain() runs, 'update' and 'delete' entries
 * always have a real targetId.
 */
type QueuedOp =
  | { id: string; createdAt: number; type: 'create'; payload: QueuedEventPayload }
  | { id: string; createdAt: number; type: 'update'; targetId: string; payload: QueuedEventPayload }
  | { id: string; createdAt: number; type: 'delete'; targetId: string };

export interface SyncConflict {
  error: ApiError;
}

export interface QueueStatus {
  pendingCount: number;
  conflict: SyncConflict | null;
  /** Ids of events with an unsynced change — a still-queued creation's own local id, or a synced event with a queued edit. For badging "not synced yet" in the UI; a queued delete doesn't need an id here since the event is filtered out of the list entirely instead. */
  pendingIds: Set<string>;
}

export interface PendingChanges {
  /** Not-yet-synced creations — only meaningful merged onto an unfiltered page 1, since they have no real position in a paginated/filtered list. */
  creates: TrackingEvent[];
  /** Queued edits, keyed by the real server id they target — applies to a fetched event on any page/filter. */
  updates: Map<string, QueuedEventPayload>;
  /** Ids with a queued delete — filter these out of a fetched list on any page/filter. */
  deletes: Set<string>;
}

type Listener = () => void;

/**
 * A durable, ordered IndexedDB write queue for tracking-event create/update/
 * delete calls made while offline, plus a reactive status store for the UI.
 * A class rather than a module of standalone functions so it can be
 * constructor-injected into the API client (see the "Make the API client's
 * cache and offline queue injectable dependencies" Roadmap item in
 * DESIGN.org) instead of being imported as a fixed module — `offlineQueue`
 * below is the one real instance the app uses, but client.ts can be pointed
 * at a different one (e.g. a test double).
 *
 * There's only ever one real queue for the whole app (same reasoning as
 * networkStatus.ts's singleton), so the reactive status below is instance
 * state shared by every subscriber of the one real instance, not per-caller
 * state.
 */
export class OfflineQueue {
  private status: QueueStatus = { pendingCount: 0, conflict: null, pendingIds: new Set() };
  private listeners = new Set<Listener>();
  private draining = false;

  constructor(private cache: OfflineCache = offlineCache) {
    // Best-effort initial sync of the reactive count on construction —
    // briefly the default status until this resolves, then self-corrects.
    this.refreshPendingCount();
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async getAllEntries(): Promise<QueuedOp[]> {
    const db = await this.openDb();
    const entries = await new Promise<Array<QueuedOp & { type?: QueuedOp['type'] }>>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Entries written by Phase 2 predate the 'type' field — they're all creates.
    return entries
      .map((e): QueuedOp => {
        if (e.type) return e as QueuedOp;
        const { id, createdAt, payload } = e as unknown as { id: string; createdAt: number; payload: QueuedEventPayload };
        return { id, createdAt, type: 'create', payload };
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  private async putEntry(entry: QueuedOp): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async removeFromQueue(id: string): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private localId(): string {
    return `local-${crypto.randomUUID()}`;
  }

  /** True for the optimistic id of a still-queued create, unsynced. */
  isLocalId(eventId: string): boolean {
    return eventId.startsWith('local-');
  }

  private async resolveProject(projectId: string | undefined): Promise<TrackingEvent['project']> {
    if (!projectId) return null;
    const cachedProjects = await this.cache.get<Project[]>('/projects');
    const match = cachedProjects?.find((p) => p.project_id === projectId);
    return match ? { project_id: match.project_id, name: match.name } : null;
  }

  private toDuration(payload: QueuedEventPayload): number {
    const ms = new Date(payload.stopped_at).getTime() - new Date(payload.started_at).getTime();
    return Math.round(ms / 1000);
  }

  /** Best-effort optimistic event for display — the project name comes from the response cache, not a network call. */
  private async toOptimisticEvent(entry: Extract<QueuedOp, { type: 'create' | 'update' }>): Promise<TrackingEvent> {
    const id = entry.type === 'create' ? entry.id : entry.targetId;
    return {
      tracking_event_id: id,
      started_at: entry.payload.started_at,
      stopped_at: entry.payload.stopped_at,
      duration_seconds: this.toDuration(entry.payload),
      task_description: entry.payload.task_description ?? null,
      project: await this.resolveProject(entry.payload.project_id),
    };
  }

  // ── Reactive queue status ──────────────────────────────────────────────

  /** Bound so it can be passed straight to useSyncExternalStore without an extra wrapper. */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Bound so it can be passed straight to useSyncExternalStore without an extra wrapper. */
  getSnapshot = (): QueueStatus => this.status;

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  private setStatus(next: Partial<QueueStatus>): void {
    this.status = { ...this.status, ...next };
    this.notify();
  }

  private async refreshPendingCount(): Promise<void> {
    try {
      const entries = await this.getAllEntries();
      const pendingIds = new Set<string>();
      for (const entry of entries) {
        if (entry.type === 'create') pendingIds.add(entry.id);
        else if (entry.type === 'update') pendingIds.add(entry.targetId);
      }
      this.setStatus({ pendingCount: entries.length, pendingIds });
    } catch (err) {
      logError(err);
    }
  }

  // ── Queue operations ────────────────────────────────────────────────────

  /** Queues a tracking event creation for later sync, returning an optimistic local TrackingEvent immediately. */
  async enqueueCreate(payload: QueuedEventPayload): Promise<TrackingEvent> {
    const entry: QueuedOp = { id: this.localId(), createdAt: Date.now(), type: 'create', payload };
    await this.putEntry(entry);
    await this.refreshPendingCount();
    return this.toOptimisticEvent(entry);
  }

  /**
   * Queues an edit for later sync, returning an optimistic TrackingEvent
   * immediately. If eventId is still only a queued create (a local-<uuid>,
   * never reached the server), the edit is folded into that create's payload
   * in place — there's nothing server-side to PATCH yet, and this keeps a
   * single 'create' entry carrying the latest desired state instead of
   * stacking an 'update' entry on top of it. Otherwise it upserts a single
   * 'update' entry for that target — a second edit before the first syncs
   * replaces the payload rather than stacking, since only the final desired
   * state matters.
   */
  async enqueueUpdate(eventId: string, payload: QueuedEventPayload): Promise<TrackingEvent> {
    const entries = await this.getAllEntries();

    if (this.isLocalId(eventId)) {
      const createEntry = entries.find(
        (e): e is Extract<QueuedOp, { type: 'create' }> => e.type === 'create' && e.id === eventId,
      );
      if (!createEntry) throw new Error(`No queued creation found for ${eventId}`);
      const merged: QueuedOp = { ...createEntry, payload };
      await this.putEntry(merged);
      return this.toOptimisticEvent(merged);
    }

    const existing = entries.find(
      (e): e is Extract<QueuedOp, { type: 'update' }> => e.type === 'update' && e.targetId === eventId,
    );
    const entry: QueuedOp = existing
      ? { ...existing, payload }
      : { id: this.localId(), createdAt: Date.now(), type: 'update', targetId: eventId, payload };
    await this.putEntry(entry);
    await this.refreshPendingCount();
    return this.toOptimisticEvent(entry);
  }

  /**
   * Queues a delete for later sync. If eventId is still only a queued create,
   * there's nothing server-side to DELETE — the create (and any edit already
   * folded into it) is simply dropped from the queue. Otherwise any queued
   * 'update' for that target is dropped too (moot once the event is deleted)
   * and a single 'delete' entry is upserted.
   */
  async enqueueDelete(eventId: string): Promise<void> {
    const entries = await this.getAllEntries();

    if (this.isLocalId(eventId)) {
      await this.removeFromQueue(eventId);
      await this.refreshPendingCount();
      return;
    }

    const existingUpdate = entries.find((e) => e.type === 'update' && e.targetId === eventId);
    if (existingUpdate) await this.removeFromQueue(existingUpdate.id);

    const existingDelete = entries.find((e) => e.type === 'delete' && e.targetId === eventId);
    const entry: QueuedOp = existingDelete ?? {
      id: this.localId(),
      createdAt: Date.now(),
      type: 'delete',
      targetId: eventId,
    };
    await this.putEntry(entry);
    await this.refreshPendingCount();
  }

  /** All not-yet-synced creations, oldest first, as optimistic TrackingEvents for merging into fetched lists. */
  async getPendingCreates(): Promise<TrackingEvent[]> {
    try {
      const entries = await this.getAllEntries();
      const creates = entries.filter((e): e is Extract<QueuedOp, { type: 'create' }> => e.type === 'create');
      return await Promise.all(creates.map((e) => this.toOptimisticEvent(e)));
    } catch (err) {
      logError(err);
      return [];
    }
  }

  /** Snapshot of every queued change, shaped for merging into whatever a page just fetched. */
  async getPendingChanges(): Promise<PendingChanges> {
    try {
      const entries = await this.getAllEntries();
      const creates = await Promise.all(
        entries
          .filter((e): e is Extract<QueuedOp, { type: 'create' }> => e.type === 'create')
          .map((e) => this.toOptimisticEvent(e)),
      );
      const updates = new Map<string, QueuedEventPayload>();
      const deletes = new Set<string>();
      for (const entry of entries) {
        if (entry.type === 'update') updates.set(entry.targetId, entry.payload);
        if (entry.type === 'delete') deletes.add(entry.targetId);
      }
      return { creates, updates, deletes };
    } catch (err) {
      logError(err);
      return { creates: [], updates: new Map(), deletes: new Set() };
    }
  }

  /**
   * Applies queued edits/deletes onto a list of already-fetched events (any
   * page, any filter — unlike `creates`, which only makes sense merged onto
   * an unfiltered page 1). project_id is resolved against the given projects
   * list rather than the response cache, since callers already have it
   * loaded. Synchronous — no IO of its own.
   */
  applyPendingChanges(
    events: TrackingEvent[],
    pending: Pick<PendingChanges, 'updates' | 'deletes'>,
    projects: Project[],
  ): TrackingEvent[] {
    return events
      .filter((e) => !pending.deletes.has(e.tracking_event_id))
      .map((e) => {
        const patch = pending.updates.get(e.tracking_event_id);
        if (!patch) return e;
        const project = patch.project_id ? projects.find((p) => p.project_id === patch.project_id) : undefined;
        return {
          ...e,
          started_at: patch.started_at,
          stopped_at: patch.stopped_at,
          duration_seconds: this.toDuration(patch),
          task_description: patch.task_description ?? null,
          project: project ? { project_id: project.project_id, name: project.name } : null,
        };
      });
  }

  /**
   * Attempts to sync every queued change, oldest first. Stops at the first
   * item rejected by the server (a real conflict, e.g. overlapping sessions,
   * or a 404 because the target was deleted elsewhere) rather than dropping
   * it or skipping ahead — per the "surface and stop, no auto-merge" policy
   * in DESIGN.org. Stops silently (no conflict recorded) on a renewed
   * network failure, to retry on the next trigger. Guarded against
   * concurrent calls (e.g. the 'online' event and an on-load check firing
   * close together) — running two drains at once could double-send the same
   * item.
   *
   * Takes the request function as a parameter rather than importing it from
   * api/client.ts, so this module stays agnostic of that module's concrete
   * implementation — callers (api/client.ts, tests) supply it.
   */
  async drain(requestFn: RequestFn): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const entries = await this.getAllEntries();
      for (const entry of entries) {
        try {
          if (entry.type === 'create') {
            await requestFn<TrackingEvent>('/tracking', { method: 'POST', body: JSON.stringify(entry.payload) });
          } else if (entry.type === 'update') {
            await requestFn<TrackingEvent>(`/tracking/${entry.targetId}`, {
              method: 'PATCH',
              body: JSON.stringify(entry.payload),
            });
          } else {
            await requestFn<void>(`/tracking/${entry.targetId}`, { method: 'DELETE' });
          }
          await this.removeFromQueue(entry.id);
          await this.refreshPendingCount();
          this.setStatus({ conflict: null });
        } catch (err) {
          if (err instanceof ApiError) {
            logError(err);
            this.setStatus({ conflict: { error: err } });
          }
          // Either a real rejection or a renewed network failure — either way,
          // stop draining here; remaining items stay queued in order.
          return;
        }
      }
    } finally {
      this.draining = false;
    }
  }
}

/** The one real queue for the app — there's only ever one real set of pending changes. */
export const offlineQueue = new OfflineQueue();

/** Reactive {pendingCount, conflict, pendingIds} for the one real offlineQueue instance above. */
export function useQueueStatus(): QueueStatus {
  return useSyncExternalStore(offlineQueue.subscribe, offlineQueue.getSnapshot);
}
