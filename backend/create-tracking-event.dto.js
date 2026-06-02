"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTrackingEventDto = void 0;
const class_validator_1 = require("class-validator");
/**
 * Custom constraint: stopped_at must be after started_at.
 * class-validator doesn't have a built-in cross-field date comparison,
 * so we write a small constraint for it.
 */
@(0, class_validator_1.ValidatorConstraint)({ name: 'isAfterStartedAt', async: false })
class IsAfterStartedAt {
    validate(stoppedAt, args) {
        const obj = args.object;
        if (!obj.started_at)
            return true; // started_at already fails its own rule
        return new Date(stoppedAt) > new Date(obj.started_at);
    }
    defaultMessage() {
        return 'stopped_at must be after started_at';
    }
}
class CreateTrackingEventDto {
    @(0, class_validator_1.IsDateString)({}, { message: 'started_at must be a valid ISO 8601 date string' })
    started_at;
    @(0, class_validator_1.IsDateString)({}, { message: 'stopped_at must be a valid ISO 8601 date string' })
    @(0, class_validator_1.Validate)(IsAfterStartedAt)
    stopped_at;
    @(0, class_validator_1.IsOptional)()
    @(0, class_validator_1.IsString)()
    @(0, class_validator_1.MaxLength)(500, { message: 'Task description cannot exceed 500 characters' })
    task_description;
    @(0, class_validator_1.IsOptional)()
    @(0, class_validator_1.IsUUID)('4', { message: 'project_id must be a valid UUID' })
    project_id;
}
exports.CreateTrackingEventDto = CreateTrackingEventDto;
//# sourceMappingURL=create-tracking-event.dto.js.map