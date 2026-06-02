import { TrackingEvent } from '../../database/entities/tracking-event.entity';

export interface ProjectSummary {
  project_id: string;
  name: string;
}

export interface TrackingEventResponse {
  tracking_event_id: string;
  started_at: string;
  stopped_at: string;
  duration_seconds: number;
  task_description: string | null;
  project: ProjectSummary | null;
}

/**
 * Converts a TrackingEvent entity into the API response shape.
 * Computes duration_seconds so the frontend never has to do date math.
 */
export function toTrackingEventResponse(
  event: TrackingEvent,
): TrackingEventResponse {
  const durationMs =
    new Date(event.stopped_at).getTime() - new Date(event.started_at).getTime();

  return {
    tracking_event_id: event.tracking_event_id,
    started_at: event.started_at.toISOString(),
    stopped_at: event.stopped_at.toISOString(),
    duration_seconds: Math.round(durationMs / 1000),
    task_description: event.task_description,
    project: event.project
      ? { project_id: event.project.project_id, name: event.project.name }
      : null,
  };
}
