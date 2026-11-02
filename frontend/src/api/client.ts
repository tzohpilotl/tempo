import type { User, Project, ProjectStats, TrackingEvent, TrackingEventsPage, TrackingSummaryResponse } from "../types";
import type { DateRange } from "../utils/dateRange";
import { offlineCache } from "../utils/offlineCache";
import { offlineQueue, useQueueStatus, type QueuedEventPayload, type PendingChanges, type SyncConflict } from "../utils/offlineQueue";
import { reportNetworkSuccess, reportNetworkFailure } from "../utils/networkStatus";
import { getExistingPushSubscription, requestPushSubscription } from "../utils/pushNotifications";

const BASE = "/api";

/**
 * The cache `request()` falls back to on a network-level GET failure, and
 * writes through on a successful GET. Defaults to the one real OfflineCache
 * instance in utils/offlineCache.ts — constructor-style injected rather than
 * imported and used directly, so the client's caching behavior can be
 * swapped (tests, or a different OfflineCache instance) without reaching
 * into that module. See the "Make the API client's cache and offline queue
 * injectable dependencies" Roadmap item in DESIGN.org.
 */
export interface ApiCache {
  get<T>(path: string): Promise<T | undefined>;
  set(path: string, value: unknown): Promise<void>;
}

let cache: ApiCache = offlineCache;

/** Swaps the cache request() reads from/writes to. Exported for tests. */
export function configureCache(next: ApiCache = offlineCache): void {
  cache = next;
}

/**
 * The offline write queue tracking.log/update/delete fall back to on a
 * network-level failure. Defaults to the one real OfflineQueue instance in
 * utils/offlineQueue.ts. Injected the same way as the cache above, so
 * application code never needs to import offlineQueue.ts itself — it goes
 * through this module's public surface (tracking.*, syncPendingChanges,
 * getPendingChanges, applyPendingChanges, useQueueStatus) instead.
 */
export interface ApiQueue {
  enqueueCreate(payload: QueuedEventPayload): Promise<TrackingEvent>;
  enqueueUpdate(eventId: string, payload: QueuedEventPayload): Promise<TrackingEvent>;
  enqueueDelete(eventId: string): Promise<void>;
  isLocalId(eventId: string): boolean;
  drain(requestFn: typeof request): Promise<void>;
  getPendingChanges(): Promise<PendingChanges>;
  applyPendingChanges(events: TrackingEvent[], pending: Pick<PendingChanges, "updates" | "deletes">, projects: Project[]): TrackingEvent[];
}

let queue: ApiQueue = offlineQueue;

/** Swaps the offline queue tracking.* falls back to. Exported for tests. */
export function configureQueue(next: ApiQueue = offlineQueue): void {
  queue = next;
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isGet = (options?.method ?? "GET").toUpperCase() === "GET";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: "include", // always send the session cookie
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    // Reaching the server at all — even with an error status handled below —
    // proves connectivity is currently fine.
    reportNetworkSuccess();
  } catch (networkErr) {
    reportNetworkFailure();
    // Only GETs have a cached fallback to offer — fallback for writes is
    // tracking.log/update/delete's job (queuing them via `queue` above).
    if (isGet) {
      const cached = await cache.get<T>(path);
      if (cached !== undefined) return cached;
    }
    throw networkErr;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T;
  if (isGet) await cache.set(path, data);
  return data;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  /** Fetches the current user; throws ApiError(401) if not logged in. */
  me: () => request<User>("/auth/me"),

  /** Navigates to Google OAuth — not a fetch, a full redirect. */
  loginWithGoogle: () => {
    window.location.href = `${BASE}/auth/google`;
  },

  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const projects = {
  list: () => request<Project[]>("/projects"),

  stats: () => request<ProjectStats[]>("/projects/stats"),

  create: (name: string) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  update: (projectId: string, name: string) =>
    request<Project>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  delete: (projectId: string) =>
    request<void>(`/projects/${projectId}`, { method: "DELETE" }),
};

// ── Tracking ──────────────────────────────────────────────────────────────────

export const tracking = {
  list: (params: { page?: number; pageSize?: number; projectId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page !== undefined) qs.set("page", String(params.page));
    if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize));
    if (params.projectId) qs.set("projectId", params.projectId);
    const query = qs.toString();
    return request<TrackingEventsPage>(`/tracking${query ? "?" + query : ""}`);
  },

  summary: (ranges: { day: DateRange; week: DateRange; month: DateRange }) => {
    const qs = new URLSearchParams({
      dayFrom: ranges.day.from,
      dayTo: ranges.day.to,
      weekFrom: ranges.week.from,
      weekTo: ranges.week.to,
      monthFrom: ranges.month.from,
      monthTo: ranges.month.to,
    });
    return request<TrackingSummaryResponse>(`/tracking/summary?${qs.toString()}`);
  },

  /** A real ApiError (e.g. a 409 overlap) still surfaces as a rejection; a network-level failure falls back to the offline queue instead. */
  log: async (payload: QueuedEventPayload): Promise<TrackingEvent> => {
    try {
      return await request<TrackingEvent>("/tracking", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return queue.enqueueCreate(payload);
    }
  },

  /** An edit to a still-unsynced local-only event (see isLocalEventId) has nothing server-side to PATCH — it always goes straight to the queue, online or not. */
  update: async (eventId: string, payload: QueuedEventPayload): Promise<TrackingEvent> => {
    if (queue.isLocalId(eventId)) return queue.enqueueUpdate(eventId, payload);
    try {
      return await request<TrackingEvent>(`/tracking/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return queue.enqueueUpdate(eventId, payload);
    }
  },

  /** Same local-only short-circuit as update above. */
  delete: async (eventId: string): Promise<void> => {
    if (queue.isLocalId(eventId)) return queue.enqueueDelete(eventId);
    try {
      await request<void>(`/tracking/${eventId}`, { method: "DELETE" });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      await queue.enqueueDelete(eventId);
    }
  },

  /** True for the optimistic id of a not-yet-synced queued creation — callers use this to decide whether an edit/delete can skip straight to the queue (see update/delete above) or needs the real event list filtered/patched (see applyPendingChanges). */
  isLocalEventId: (eventId: string): boolean => queue.isLocalId(eventId),

  /** Snapshot of every queued-but-unsynced change, shaped for merging into whatever a page just fetched. */
  getPendingChanges: (): Promise<PendingChanges> => queue.getPendingChanges(),

  /** Applies queued edits/deletes onto an already-fetched event list — see utils/offlineQueue.ts's applyPendingChanges for the merge rules. */
  applyPendingChanges: (
    events: TrackingEvent[],
    pending: Pick<PendingChanges, "updates" | "deletes">,
    projects: Project[],
  ): TrackingEvent[] => queue.applyPendingChanges(events, pending, projects),

  /** Drains every queued change, oldest first, stopping at the first real conflict — see OfflineQueue.drain in utils/offlineQueue.ts for the full policy. Call on reconnect. */
  syncPendingChanges: (): Promise<void> => queue.drain(request),

  /** Reactive {pendingCount, conflict, pendingIds} for the offline banner/badges — see utils/offlineQueue.ts's useQueueStatus. */
  useQueueStatus,
};

export type { SyncConflict, PendingChanges, QueuedEventPayload };

// ── Notifications ──────────────────────────────────────────────────────────────

/** Injected rather than imported directly by subscribe/unsubscribe below, so tests can pass a mock instead of mocking utils/pushNotifications.ts wholesale — same reasoning as OfflineQueue.drain's RequestFn parameter in offlineQueue.ts. */
type RequestPushSubscriptionFn = (vapidPublicKey: string) => Promise<PushSubscription>;
type GetExistingPushSubscriptionFn = () => Promise<PushSubscription | null>;

export const notifications = {
  /** Requests permission, subscribes via the browser's push service, and registers the subscription with the backend. */
  subscribe: async (subscribe: RequestPushSubscriptionFn = requestPushSubscription): Promise<void> => {
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) throw new Error("VITE_VAPID_PUBLIC_KEY is not configured");

    const subscription = await subscribe(vapidPublicKey);
    await request<void>("/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription.toJSON()),
    });
  },

  /** Unsubscribes both the backend record and the browser's own subscription. Safe to call with nothing subscribed. */
  unsubscribe: async (getExisting: GetExistingPushSubscriptionFn = getExistingPushSubscription): Promise<void> => {
    const subscription = await getExisting();
    if (!subscription) return;

    await request<void>("/notifications/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  },

  isSubscribed: async (getExisting: GetExistingPushSubscriptionFn = getExistingPushSubscription): Promise<boolean> =>
    (await getExisting()) !== null,

  test: () => request<void>("/notifications/test", { method: "POST" }),
};
