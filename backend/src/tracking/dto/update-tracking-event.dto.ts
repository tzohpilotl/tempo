import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

/**
 * All fields optional — a PATCH only touches what's provided.
 * Cross-field validation (stopped_at > started_at, paused_seconds within the
 * resolved span) happens in the service, since it needs to merge against the
 * existing event when only some fields are being changed.
 */
export class UpdateTrackingEventDto {
  @IsOptional()
  @IsDateString({}, { message: 'started_at must be a valid ISO 8601 date string' })
  started_at?: string;

  @IsOptional()
  @IsDateString({}, { message: 'stopped_at must be a valid ISO 8601 date string' })
  stopped_at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Task description cannot exceed 500 characters' })
  task_description?: string;

  @IsOptional()
  @IsUUID('4', { message: 'project_id must be a valid UUID' })
  project_id?: string;

  @IsOptional()
  @IsInt({ message: 'paused_seconds must be an integer' })
  @Min(0, { message: 'paused_seconds cannot be negative' })
  paused_seconds?: number;
}
