import { Injectable, ConflictException } from '@nestjs/common';
import { ProjectRepository } from '../database/repositories/project.repository';
import { Project } from '../database/entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectRepository) {}

  /**
   * Returns all projects belonging to the authenticated user,
   * ordered newest first.
   */
  async findAllForUser(userId: string): Promise<Project[]> {
    return this.projects.findAllByUser(userId);
  }

  /**
   * Creates a new project for the user.
   * Enforces uniqueness of project names per user.
   */
  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const existing = await this.projects.findByNameAndUser(dto.name, userId);

    if (existing) {
      throw new ConflictException(
        `You already have a project named "${dto.name}"`,
      );
    }

    return this.projects.create({ name: dto.name, user_id: userId });
  }
}
