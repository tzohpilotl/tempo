"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingEventRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tracking_event_entity_1 = require("../entities/tracking-event.entity");
const repository_interfaces_1 = require("./repository.interfaces");
@(0, common_1.Injectable)()
class TrackingEventRepository {
    orm;
    constructor(
    @(0, typeorm_1.InjectRepository)(tracking_event_entity_1.TrackingEvent)
    orm) {
        this.orm = orm;
    }
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
    findAllByUser(userId) {
        return this.orm
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.project', 'project')
            .where('(project.user_id = :userId OR event.project_id IS NULL)', { userId })
            .orderBy('event.started_at', 'DESC')
            .getMany();
    }
    async create(data) {
        const event = this.orm.create({
            started_at: data.started_at,
            stopped_at: data.stopped_at,
            task_description: data.task_description ?? null,
            project_id: data.project_id ?? null,
        });
        return this.orm.save(event);
    }
}
exports.TrackingEventRepository = TrackingEventRepository;
//# sourceMappingURL=tracking-event.repository.js.map