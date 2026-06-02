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
export declare function toTrackingEventResponse(event: TrackingEvent): TrackingEventResponse;
//# sourceMappingURL=tracking-event-response.dto.d.ts.map