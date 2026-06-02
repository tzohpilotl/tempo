import { TrackingService } from './tracking.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { TrackingEventResponse } from './dto/tracking-event-response.dto';
import { User } from '../database/entities/user.entity';
export declare class TrackingController {
    private readonly trackingService;
    constructor(trackingService: TrackingService);
    /**
     * GET /api/tracking
     * Returns all tracking events for the logged-in user, newest first.
     * Each event includes computed duration_seconds and a project summary.
     */
    findAll(user: User): Promise<TrackingEventResponse[]>;
    /**
     * POST /api/tracking
     * Logs a completed timer session for the logged-in user.
     *
     * Body: {
     *   started_at: string        (ISO 8601, required)
     *   stopped_at: string        (ISO 8601, required, must be after started_at)
     *   task_description?: string (optional, max 500 chars)
     *   project_id?: string       (optional UUID — must belong to this user)
     * }
     */
    create(user: User, dto: CreateTrackingEventDto): Promise<TrackingEventResponse>;
}
//# sourceMappingURL=tracking.controller.d.ts.map