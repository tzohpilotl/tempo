import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';

@Controller('projects')
@UseGuards(AuthenticatedGuard) // every route in this controller requires login
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * GET /api/projects
   * Returns all projects for the logged-in user.
   */
  @Get()
  findAll(@CurrentUser() user: User): Promise<Project[]> {
    return this.projectsService.findAllForUser(user.user_id);
  }

  /**
   * POST /api/projects
   * Body: { name: string }
   * Creates a new project scoped to the logged-in user.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateProjectDto,
  ): Promise<Project> {
    return this.projectsService.create(user.user_id, dto);
  }
}
