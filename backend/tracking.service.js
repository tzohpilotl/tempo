"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingService = void 0;
const common_1 = require("@nestjs/common");
const tracking_event_repository_1 = require("../database/repositories/tracking-event.repository");
const project_repository_1 = require("../database/repositories/project.repository");
const tracking_event_entity_1 = require("../database/entities/tracking-event.entity");
const create_tracking_event_dto_1 = require("./dto/create-tracking-event.dto");
@(0, common_1.Injectable)()
class TrackingService {
    events;
    projects;
    constructor(events, projects) {
        this.events = events;
        this.projects = projects;
    }
    /**
     * Returns all tracking events for the authenticated user,
     * newest first, with project info joined in.
     */
    async findAllForUser(userId) {
        return this.events.findAllByUser(userId);
    }
    /**
     * Logs a completed timer session.
     *
     * If a project_id is provided, verifies it exists and belongs to
     * this user before attaching it — prevents users from writing
     * events to other users' projects.
     */
    async create(userId, dto) {
        // Validate duration is positive (cross-field check already in DTO,
        // but we double-check here to be safe)
        const started = new Date(dto.started_at);
        const stopped = new Date(dto.stopped_at);
        if (stopped <= started) {
            throw new common_1.BadRequestException('stopped_at must be after started_at');
        }
        // If a project was specified, verify ownership
        if (dto.project_id) {
            const project = await this.projects.findById(dto.project_id);
            if (!project) {
                throw new common_1.NotFoundException(`Project with id "${dto.project_id}" not found`);
            }
            if (project.user_id !== userId) {
                // Return 404 rather than 403 — don't confirm the project exists
                throw new common_1.NotFoundException(`Project with id "${dto.project_id}" not found`);
            }
        }
        return this.events.create({
            started_at: started,
            stopped_at: stopped,
            task_description: dto.task_description ?? null,
            project_id: dto.project_id ?? null,
        });
    }
}
exports.TrackingService = TrackingService;
//# sourceMappingURL=tracking.service.js.map