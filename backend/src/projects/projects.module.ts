import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project } from '../database/entities/project.entity';
import { ProjectRepository } from '../database/repositories/project.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectRepository],
  // Export ProjectRepository so TrackingModule can verify project ownership
  exports: [ProjectsService, ProjectRepository],
})
export class ProjectsModule {}
