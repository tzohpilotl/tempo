import { useSyncExternalStore } from 'react';
import type { Project, TrackingEvent } from '../types';
import { ApiError } from '../api/client';
import { getCached } from './offlineCache';
import { logError } from './logger';

/** Matches api/client.ts's request() shape — injected rather than imported, so this module never depends on client.ts's implementation, only on ApiError for conflict detection. */
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

interface QueuedEvent {
  id: string;
  createdAt: number;
  payload: QueuedEventPayload;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllEntries(): Promise<QueuedEvent[]> {
  const db = await openDb();
  const entries = await new Promise<QueuedEvent[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

async function removeFromQueue(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function localId(): string {
  return `local-${crypto.randomUUID()}`;
}

/** Best-effort optimistic event for display — the project name comes from the Phase 1 response cache, not a network call. */
async function toOptimisticEvent(entry: QueuedEvent): Promise<TrackingEvent> {
  const durationMs =
    new Date(entry.payload.stopped_at).getTime() - new Date(entry.payload.started_at).getTime();

  let project: TrackingEvent['project'] = null;
  if (entry.payload.project_id) {
    const cachedProjects = await getCached<Project[]>('/projects');
    const match = cachedProjects?.find((p) => p.project_id === entry.payload.project_id);
    if (match) project = { project_id: match.project_id, name: match.name };
  }

  return {
    tracking_event_id: entry.id,
    started_at: entry.payload.started_at,
    stopped_at: entry.payload.stopped_at,
    duration_seconds: Math.round(durationMs / 1000),
    task_description: entry.payload.task_description ?? null,
    project,
  };
}

// ── Reactive queue status ────────────────────────────────────────────────────
// One shared singleton — there's only ever one real queue for the app, same
// reasoning as networkStatus.ts.

export interface SyncConflict {
  event: TrackingEvent;
  error: ApiError;
}

interface QueueStatus {
  pendingCount: number;
  conflict: SyncConflict | null;
}

type Listener = () => void;

let status: QueueStatus = { pendingCount: 0, conflict: null };
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function setStatus(next: Partial<QueueStatus>): void {
  status = { ...status, ...next };
  notify();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useQueueStatus(): QueueStatus {
  return useSyncExternalStore(subscribe, () => status);
}

async function refreshPendingCount(): Promise<void> {
  try {
    const entries = await getAllEntries();
    setStatus({ pendingCount: entries.length });
  } catch (err) {
    logError(err);
  }
}

// Best-effort initial sync of the reactive count on module load — briefly 0
// until this resolves, then self-corrects.
refreshPendingCount();

// ── Queue operations ─────────────────────────────────────────────────────────

/** Queues a tracking event creation for later sync, returning an optimistic local TrackingEvent immediately. */
export async function queueEventCreate(payload: QueuedEventPayload): Promise<TrackingEvent> {
  const entry: QueuedEvent = { id: localId(), createdAt: Date.now(), payload };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await refreshPendingCount();

  return toOptimisticEvent(entry);
}

/** All not-yet-synced events, oldest first, as optimistic TrackingEvents for merging into fetched lists. */
export async function getPendingEvents(): Promise<TrackingEvent[]> {
  try {
    const entries = await getAllEntries();
    return await Promise.all(entries.map(toOptimisticEvent));
  } catch (err) {
    logError(err);
    return [];
  }
}

let draining = false;

/**
 * Attempts to sync every queued event, oldest first. Stops at the first item
 * rejected by the server (a real conflict, e.g. overlapping sessions) rather
 * than dropping it or skipping ahead — per the "surface and stop, no
 * auto-merge" policy in DESIGN.org. Stops silently (no conflict recorded) on
 * a renewed network failure, to retry on the next trigger. Guarded against
 * concurrent calls (e.g. the 'online' event and an on-load check firing close
 * together) — running two drains at once could double-POST the same item.
 *
 * Takes the request function as a parameter rather than importing it from
 * api/client.ts, so this module stays agnostic of that module's concrete
 * implementation — callers (App.tsx, tests) supply it.
 */
export async function drainQueue(requestFn: RequestFn): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const entries = await getAllEntries();
    for (const entry of entries) {
      try {
        await requestFn<TrackingEvent>('/tracking', {
          method: 'POST',
          body: JSON.stringify(entry.payload),
        });
        await removeFromQueue(entry.id);
        await refreshPendingCount();
        setStatus({ conflict: null });
      } catch (err) {
        if (err instanceof ApiError) {
          logError(err);
          setStatus({ conflict: { event: await toOptimisticEvent(entry), error: err } });
        }
        // Either a real rejection or a renewed network failure — either way,
        // stop draining here; remaining items stay queued in order.
        return;
      }
    }
  } finally {
    draining = false;
  }
}
