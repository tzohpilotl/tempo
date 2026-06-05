import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { ProjectStats } from '../database/repositories/repository.interfaces';

@Controller('projects')
@UseGuards(AuthenticatedGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /** GET /api/projects */
  @Get()
  findAll(@CurrentUser() user: User): Promise<Project[]> {
    return this.projectsService.findAllForUser(user.user_id);
  }

  /** GET /api/projects/stats */
  @Get('stats')
  getStats(@CurrentUser() user: User): Promise<ProjectStats[]> {
    return this.projectsService.getStats(user.user_id);
  }

  /** POST /api/projects */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() dto: CreateProjectDto): Promise<Project> {
    return this.projectsService.create(user.user_id, dto);
  }

  /** PATCH /api/projects/:id */
  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    return this.projectsService.update(user.user_id, id, dto);
  }

  /** DELETE /api/projects/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.projectsService.delete(user.user_id, id);
  }
}
