import { TrackingEventRepository } from '../database/repositories/tracking-event.repository';
import { ProjectRepository } from '../database/repositories/project.repository';
import { TrackingEvent } from '../database/entities/tracking-event.entity';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
export declare class TrackingService {
    private readonly events;
    private readonly projects;
    constructor(events: TrackingEventRepository, projects: ProjectRepository);
    /**
     * Returns all tracking events for the authenticated user,
     * newest first, with project info joined in.
     */
    findAllForUser(userId: string): Promise<TrackingEvent[]>;
    /**
     * Logs a completed timer session.
     *
     * If a project_id is provided, verifies it exists and belongs to
     * this user before attaching it — prevents users from writing
     * events to other users' projects.
     */
    create(userId: string, dto: CreateTrackingEventDto): Promise<TrackingEvent>;
}
//# sourceMappingURL=tracking.service.d.ts.map