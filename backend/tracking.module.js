"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const tracking_controller_1 = require("./tracking.controller");
const tracking_service_1 = require("./tracking.service");
const tracking_event_entity_1 = require("../database/entities/tracking-event.entity");
const tracking_event_repository_1 = require("../database/repositories/tracking-event.repository");
const projects_module_1 = require("../projects/projects.module");
@(0, common_1.Module)({
    imports: [
        typeorm_1.TypeOrmModule.forFeature([tracking_event_entity_1.TrackingEvent]),
        // Import ProjectsModule to access ProjectRepository for ownership checks
        projects_module_1.ProjectsModule,
    ],
    controllers: [tracking_controller_1.TrackingController],
    providers: [tracking_service_1.TrackingService, tracking_event_repository_1.TrackingEventRepository],
})
class TrackingModule {
}
exports.TrackingModule = TrackingModule;
//# sourceMappingURL=tracking.module.js.map