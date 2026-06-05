import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectRepository } from '../database/repositories/project.repository';
import { Project } from '../database/entities/project.entity';
import { ProjectStats } from '../database/repositories/repository.interfaces';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectRepository) {}

  async findAllForUser(userId: string): Promise<Project[]> {
    return this.projects.findAllByUser(userId);
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const existing = await this.projects.findByNameAndUser(dto.name, userId);
    if (existing) {
      throw new ConflictException(`You already have a project named "${dto.name}"`);
    }
    return this.projects.create({ name: dto.name, user_id: userId });
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException();

    const conflict = await this.projects.findByNameAndUser(dto.name, userId);
    if (conflict && conflict.project_id !== projectId) {
      throw new ConflictException(`You already have a project named "${dto.name}"`);
    }

    return this.projects.update(projectId, dto.name);
  }

  async delete(userId: string, projectId: string): Promise<void> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException();
    await this.projects.delete(projectId);
  }

  async getStats(userId: string): Promise<ProjectStats[]> {
    return this.projects.getStatsForUser(userId);
  }
}
