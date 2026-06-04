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

export interface TrackingEventsPage {
  data: TrackingEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
