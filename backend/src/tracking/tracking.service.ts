import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  TrackingEventRepository,
  DateRange,
} from '../database/repositories/tracking-event.repository';
import { ProjectRepository } from '../database/repositories/project.repository';
import { TrackingEvent } from '../database/entities/tracking-event.entity';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { UpdateTrackingEventDto } from './dto/update-tracking-event.dto';
import {
  TrackingTimeSummary,
  TrackingSummaryResponse,
} from './dto/tracking-event-response.dto';

@Injectable()
export class TrackingService {
  constructor(
    private readonly events: TrackingEventRepository,
    private readonly projects: ProjectRepository,
  ) {}

  /**
   * Returns all tracking events for the authenticated user,
   * newest first, with project info joined in.
   */
  async findAllForUser(userId: string): Promise<TrackingEvent[]> {
    return this.events.findAllByUser(userId);
  }

  async getSummaryForUser(
    userId: string,
    ranges: { day: DateRange; week: DateRange; month: DateRange },
  ): Promise<TrackingSummaryResponse> {
    const rows = await this.events.getSummaryByProject(userId, ranges);

    const buildSummary = (
      field: 'total_seconds' | 'day_seconds' | 'week_seconds' | 'month_seconds',
    ): TrackingTimeSummary => {
      const breakdown = rows
        .filter((r) => Number(r[field]) > 0)
        .map((r) => ({
          project_id: r.project_id ?? null,
          name: r.name ?? null,
          total_seconds: Number(r[field]),
        }))
        .sort((a, b) => b.total_seconds - a.total_seconds);
      const total_seconds = breakdown.reduce((sum, r) => sum + r.total_seconds, 0);
      return { breakdown, total_seconds };
    };

    return {
      allTime: buildSummary('total_seconds'),
      day: buildSummary('day_seconds'),
      week: buildSummary('week_seconds'),
      month: buildSummary('month_seconds'),
    };
  }

  async findPaginated(
    userId: string,
    page: number,
    pageSize: number,
    projectId?: string,
  ): Promise<{ data: TrackingEvent[]; total: number }> {
    return this.events.findPaginated(userId, page, pageSize, projectId);
  }

  /**
   * Logs a completed timer session.
   *
   * If a project_id is provided, verifies it exists and belongs to
   * this user before attaching it — prevents users from writing
   * events to other users' projects.
   */
  async create(
    userId: string,
    dto: CreateTrackingEventDto,
  ): Promise<TrackingEvent> {
    // Validate duration is positive (cross-field check already in DTO,
    // but we double-check here to be safe)
    const started = new Date(dto.started_at);
    const stopped = new Date(dto.stopped_at);

    if (stopped <= started) {
      throw new BadRequestException('stopped_at must be after started_at');
    }

    // If a project was specified, verify ownership
    if (dto.project_id) {
      const project = await this.projects.findById(dto.project_id);

      if (!project) {
        throw new NotFoundException(
          `Project with id "${dto.project_id}" not found`,
        );
      }

      if (project.user_id !== userId) {
        // Return 404 rather than 403 — don't confirm the project exists
        throw new NotFoundException(
          `Project with id "${dto.project_id}" not found`,
        );
      }
    }

    await this.assertNoOverlap(userId, started, stopped);

    return this.events.create({
      started_at: started,
      stopped_at: stopped,
      task_description: dto.task_description ?? null,
      project_id: dto.project_id ?? null,
    });
  }

  /**
   * Updates a tracking event. Only fields present in the DTO are changed;
   * omitted fields keep their existing value.
   */
  async update(
    userId: string,
    eventId: string,
    dto: UpdateTrackingEventDto,
  ): Promise<TrackingEvent> {
    const event = await this.events.findByIdForUser(eventId, userId);
    if (!event) {
      throw new NotFoundException(`Tracking event with id "${eventId}" not found`);
    }

    const started_at = dto.started_at ? new Date(dto.started_at) : event.started_at;
    const stopped_at = dto.stopped_at ? new Date(dto.stopped_at) : event.stopped_at;

    if (stopped_at <= started_at) {
      throw new BadRequestException('stopped_at must be after started_at');
    }

    const project_id = dto.project_id !== undefined ? dto.project_id : event.project_id;

    if (project_id) {
      const project = await this.projects.findById(project_id);
      if (!project || project.user_id !== userId) {
        throw new NotFoundException(`Project with id "${project_id}" not found`);
      }
    }

    await this.assertNoOverlap(userId, started_at, stopped_at, eventId);

    return this.events.update(eventId, {
      started_at,
      stopped_at,
      task_description:
        dto.task_description !== undefined ? dto.task_description : event.task_description,
      project_id,
    });
  }

  async delete(userId: string, eventId: string): Promise<void> {
    const event = await this.events.findByIdForUser(eventId, userId);
    if (!event) {
      throw new NotFoundException(`Tracking event with id "${eventId}" not found`);
    }
    await this.events.delete(eventId);
  }

  /**
   * A person can only work one session at a time, so overlapping events
   * would double-count time in the summary. Rejects [startedAt, stoppedAt)
   * if it overlaps any other event of this user's; touching intervals
   * (one ending exactly when another starts) are allowed.
   */
  private async assertNoOverlap(
    userId: string,
    startedAt: Date,
    stoppedAt: Date,
    excludeEventId?: string,
  ): Promise<void> {
    const overlap = await this.events.findOverlapping(
      userId,
      startedAt,
      stoppedAt,
      excludeEventId,
    );
    if (overlap) {
      throw new ConflictException(
        `This session overlaps an existing one (${overlap.started_at.toISOString()} – ${overlap.stopped_at.toISOString()})`,
      );
    }
  }
}
