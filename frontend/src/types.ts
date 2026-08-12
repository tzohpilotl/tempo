export interface User {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface Project {
  project_id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface TrackingEvent {
  tracking_event_id: string;
  started_at: string;
  stopped_at: string;
  duration_seconds: number;
  task_description: string | null;
  project: { project_id: string; name: string } | null;
}

export interface ProjectTimeSummaryItem {
  project_id: string | null;
  name: string | null;
  total_seconds: number;
}

export interface TrackingTimeSummary {
  breakdown: ProjectTimeSummaryItem[];
  total_seconds: number;
}

export interface TrackingSummaryResponse {
  allTime: TrackingTimeSummary;
  day: TrackingTimeSummary;
  week: TrackingTimeSummary;
  month: TrackingTimeSummary;
}

export interface TrackingEventsPage {
  data: TrackingEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectStats {
  project_id: string;
  name: string;
  created_at: string;
  total_seconds: number;
  event_count: number;
}
