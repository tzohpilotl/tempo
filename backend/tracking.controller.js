"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingController = void 0;
const common_1 = require("@nestjs/common");
const tracking_service_1 = require("./tracking.service");
const create_tracking_event_dto_1 = require("./dto/create-tracking-event.dto");
const tracking_event_response_dto_1 = require("./dto/tracking-event-response.dto");
const authenticated_guard_1 = require("../auth/guards/authenticated.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const user_entity_1 = require("../database/entities/user.entity");
@(0, common_1.Controller)('tracking')
@(0, common_1.UseGuards)(authenticated_guard_1.AuthenticatedGuard)
class TrackingController {
    trackingService;
    constructor(trackingService) {
        this.trackingService = trackingService;
    }
    /**
     * GET /api/tracking
     * Returns all tracking events for the logged-in user, newest first.
     * Each event includes computed duration_seconds and a project summary.
     */
    @(0, common_1.Get)()
    async findAll(
    @(0, current_user_decorator_1.CurrentUser)()
    user) {
        const events = await this.trackingService.findAllForUser(user.user_id);
        return events.map(tracking_event_response_dto_1.toTrackingEventResponse);
    }
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
    @(0, common_1.Post)()
    @(0, common_1.HttpCode)(common_1.HttpStatus.CREATED)
    async create(
    @(0, current_user_decorator_1.CurrentUser)()
    user, 
    @(0, common_1.Body)()
    dto) {
        const event = await this.trackingService.create(user.user_id, dto);
        return (0, tracking_event_response_dto_1.toTrackingEventResponse)(event);
    }
}
exports.TrackingController = TrackingController;
//# sourceMappingURL=tracking.controller.js.map