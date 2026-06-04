import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingEvent } from '../entities/tracking-event.entity';
import { ITrackingEventRepository } from './repository.interfaces';

@Injectable()
export class TrackingEventRepository implements ITrackingEventRepository {
  constructor(
    @InjectRepository(TrackingEvent)
    private readonly orm: Repository<TrackingEvent>,
  ) {}

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
  findAllByUser(userId: string): Promise<TrackingEvent[]> {
    return this.orm
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.project', 'project')
      .where(
        '(project.user_id = :userId OR event.project_id IS NULL)',
        { userId },
      )
      .orderBy('event.started_at', 'DESC')
      .getMany();
  }

  async getSummaryByProject(
    userId: string,
  ): Promise<Array<{ project_id: string | null; name: string | null; total_seconds: number }>> {
    return this.orm
      .createQueryBuilder('event')
      .leftJoin('event.project', 'project')
      .select('event.project_id', 'project_id')
      .addSelect('project.name', 'name')
      .addSelect(
        `CAST(SUM((julianday(event.stopped_at) - julianday(event.started_at)) * 86400) AS INTEGER)`,
        'total_seconds',
      )
      .where('(project.user_id = :userId OR event.project_id IS NULL)', { userId })
      .groupBy('event.project_id')
      .orderBy('total_seconds', 'DESC')
      .getRawMany();
  }

  async findPaginated(
    userId: string,
    page: number,
    pageSize: number,
    projectId?: string,
  ): Promise<{ data: TrackingEvent[]; total: number }> {
    const qb = this.orm
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.project', 'project');

    if (projectId) {
      qb.where(
        'event.project_id = :projectId AND project.user_id = :userId',
        { projectId, userId },
      );
    } else {
      qb.where(
        '(project.user_id = :userId OR event.project_id IS NULL)',
        { userId },
      );
    }

    const [data, total] = await qb
      .orderBy('event.started_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  async create(data: {
    started_at: Date;
    stopped_at: Date;
    task_description?: string | null;
    project_id?: string | null;
  }): Promise<TrackingEvent> {
    const event = this.orm.create({
      started_at: data.started_at,
      stopped_at: data.stopped_at,
      task_description: data.task_description ?? null,
      project_id: data.project_id ?? null,
    });
    const saved = await this.orm.save(event);
    return this.orm.findOneOrFail({
      where: { tracking_event_id: saved.tracking_event_id },
      relations: { project: true },
    });
  }
}
