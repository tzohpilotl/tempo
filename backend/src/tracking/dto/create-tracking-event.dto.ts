import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom constraint: stopped_at must be after started_at.
 * class-validator doesn't have a built-in cross-field date comparison,
 * so we write a small constraint for it.
 */
@ValidatorConstraint({ name: 'isAfterStartedAt', async: false })
class IsAfterStartedAt implements ValidatorConstraintInterface {
  validate(stoppedAt: string, args: ValidationArguments): boolean {
    const obj = args.object as { started_at?: string };
    if (!obj.started_at) return true; // started_at already fails its own rule
    return new Date(stoppedAt) > new Date(obj.started_at);
  }

  defaultMessage(): string {
    return 'stopped_at must be after started_at';
  }
}

export class CreateTrackingEventDto {
  @IsDateString({}, { message: 'started_at must be a valid ISO 8601 date string' })
  started_at: string;

  @IsDateString({}, { message: 'stopped_at must be a valid ISO 8601 date string' })
  @Validate(IsAfterStartedAt)
  stopped_at: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Task description cannot exceed 500 characters' })
  task_description?: string;

  @IsOptional()
  @IsUUID('4', { message: 'project_id must be a valid UUID' })
  project_id?: string;
}
