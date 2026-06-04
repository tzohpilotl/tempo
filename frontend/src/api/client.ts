import type { User, Project, TrackingEvent, TrackingEventsPage, TrackingTimeSummary } from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include", // always send the session cookie
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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

  create: (name: string) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
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

  summary: () => request<TrackingTimeSummary>("/tracking/summary"),

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
};
