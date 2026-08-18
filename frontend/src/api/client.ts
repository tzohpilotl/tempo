import type { User, Project, ProjectStats, TrackingEvent, TrackingEventsPage, TrackingSummaryResponse } from "../types";
import type { DateRange } from "../utils/dateRange";
import { getCached, setCached } from "../utils/offlineCache";
import { reportNetworkSuccess, reportNetworkFailure } from "../utils/networkStatus";

const BASE = "/api";

/** Exported so App.tsx can inject it into offlineQueue.ts's sync engine — everything else should go through auth/projects/tracking. */
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
    // Only GETs have a cached fallback to offer — writes made offline still
    // fail here today (queuing them is a later phase of offline support).
    if (isGet) {
      const cached = await getCached<T>(path);
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
  if (isGet) await setCached(path, data);
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

  logout: () => request<void>("/auth/logout"),
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

  log: (payload: {
    started_at: string;
    stopped_at: string;
    task_description?: string;
    project_id?: string;
  }) =>
    request<TrackingEvent>("/tracking", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (
    eventId: string,
    payload: {
      started_at?: string;
      stopped_at?: string;
      task_description?: string;
      project_id?: string;
    },
  ) =>
    request<TrackingEvent>(`/tracking/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  delete: (eventId: string) =>
    request<void>(`/tracking/${eventId}`, { method: "DELETE" }),
};
