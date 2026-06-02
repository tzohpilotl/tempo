import { Repository } from 'typeorm';
import { TrackingEvent } from '../entities/tracking-event.entity';
import { ITrackingEventRepository } from './repository.interfaces';
export declare class TrackingEventRepository implements ITrackingEventRepository {
    private readonly orm;
    constructor(orm: Repository<TrackingEvent>);
    /**
     * Returns all events for a user, joining project info.
     *
     * Events can have no project (project_id IS NULL), so we use a LEFT JOIN
     * and filter by both cases:
     *   - events linked to a project owned by this user
     *   - events with no project (can only be created by this user — see service)
     *
     * NOTE: Because unlinked events have no direct user_id column, we rely on
     * the service layer ensuring only the owner can create them. A future
     * migration could add a user_id column to tracking_events for a cleaner query.
     */
    findAllByUser(userId: string): Promise<TrackingEvent[]>;
    create(data: {
        started_at: Date;
        stopped_at: Date;
        task_description?: string | null;
        project_id?: string | null;
    }): Promise<TrackingEvent>;
}
//# sourceMappingURL=tracking-event.repository.d.ts.map