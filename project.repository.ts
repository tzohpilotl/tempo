import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { IProjectRepository } from './repository.interfaces';

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
}
