"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTrackingEventResponse = toTrackingEventResponse;
const tracking_event_entity_1 = require("../../database/entities/tracking-event.entity");
/**
 * Converts a TrackingEvent entity into the API response shape.
 * Computes duration_seconds so the frontend never has to do date math.
 */
function toTrackingEventResponse(event) {
    const durationMs = new Date(event.stopped_at).getTime() - new Date(event.started_at).getTime();
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
//# sourceMappingURL=tracking-event-response.dto.js.map