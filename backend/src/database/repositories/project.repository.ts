import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { IProjectRepository, ProjectStats } from './repository.interfaces';

@Injectable()
export class ProjectRepository implements IProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly orm: Repository<Project>,
  ) {}

  findAllByUser(userId: string): Promise<Project[]> {
    return this.orm.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  findByNameAndUser(name: string, userId: string): Promise<Project | null> {
    return this.orm.findOne({ where: { name, user_id: userId } });
  }

  findById(projectId: string): Promise<Project | null> {
    return this.orm.findOne({ where: { project_id: projectId } });
  }

  async create(data: Pick<Project, 'name' | 'user_id'>): Promise<Project> {
    const project = this.orm.create(data);
    return this.orm.save(project);
  }

  async update(projectId: string, name: string): Promise<Project> {
    await this.orm.update({ project_id: projectId }, { name });
    return this.orm.findOneOrFail({ where: { project_id: projectId } });
  }

  async delete(projectId: string): Promise<void> {
    await this.orm.delete({ project_id: projectId });
  }

  async getStatsForUser(userId: string): Promise<ProjectStats[]> {
    return this.orm.manager
      .createQueryBuilder()
      .select('p.project_id', 'project_id')
      .addSelect('p.name', 'name')
      .addSelect('p.created_at', 'created_at')
      .addSelect(
        `CAST(COALESCE(SUM((julianday(e.stopped_at) - julianday(e.started_at)) * 86400), 0) AS INTEGER)`,
        'total_seconds',
      )
      .addSelect('CAST(COUNT(e.tracking_event_id) AS INTEGER)', 'event_count')
      .from('projects', 'p')
      .leftJoin('tracking_events', 'e', 'e.project_id = p.project_id')
      .where('p.user_id = :userId', { userId })
      .groupBy('p.project_id')
      .orderBy('p.created_at', 'DESC')
      .getRawMany<ProjectStats>();
  }
}
