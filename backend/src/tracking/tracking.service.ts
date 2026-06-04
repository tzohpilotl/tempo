import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TrackingEventRepository } from '../database/repositories/tracking-event.repository';
import { ProjectRepository } from '../database/repositories/project.repository';
import { TrackingEvent } from '../database/entities/tracking-event.entity';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { TrackingTimeSummary } from './dto/tracking-event-response.dto';

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

  async getSummaryForUser(userId: string): Promise<TrackingTimeSummary> {
    const rows = await this.events.getSummaryByProject(userId);
    const total_seconds = rows.reduce((sum, r) => sum + Number(r.total_seconds), 0);
    return {
      breakdown: rows.map((r) => ({
        project_id: r.project_id ?? null,
        name: r.name ?? null,
        total_seconds: Number(r.total_seconds),
      })),
      total_seconds,
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

    return this.events.create({
      started_at: started,
      stopped_at: stopped,
      task_description: dto.task_description ?? null,
      project_id: dto.project_id ?? null,
    });
  }
}
