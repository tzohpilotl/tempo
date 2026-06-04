import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import {
  TrackingEventsPage,
  TrackingEventResponse,
  toTrackingEventResponse,
} from './dto/tracking-event-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('tracking')
@UseGuards(AuthenticatedGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  /**
   * GET /api/tracking?page=1&pageSize=20&projectId=<uuid>
   * Returns a paginated list of tracking events for the logged-in user.
   * Optionally filter by projectId.
   */
  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page') rawPage?: string,
    @Query('pageSize') rawSize?: string,
    @Query('projectId') projectId?: string,
  ): Promise<TrackingEventsPage> {
    const page = Math.max(1, Number(rawPage) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(rawSize) || 20));
    const { data, total } = await this.trackingService.findPaginated(
      user.user_id,
      page,
      pageSize,
      projectId,
    );
    return {
      data: data.map(toTrackingEventResponse),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * POST /api/tracking
   * Logs a completed timer session for the logged-in user.
   *
   * Body: {
   *   started_at: string        (ISO 8601, required)
   *   stopped_at: string        (ISO 8601, required, must be after started_at)
   *   task_description?: string (optional, max 500 chars)
   *   project_id?: string       (optional UUID — must belong to this user)
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateTrackingEventDto,
  ): Promise<TrackingEventResponse> {
    const event = await this.trackingService.create(user.user_id, dto);
    return toTrackingEventResponse(event);
  }
}
