import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { UpdateTrackingEventDto } from './dto/update-tracking-event.dto';
import {
  TrackingEventsPage,
  TrackingEventResponse,
  TrackingSummaryResponse,
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
   * GET /api/tracking/summary?dayFrom=&dayTo=&weekFrom=&weekTo=&monthFrom=&monthTo=
   * Total time grouped by project for the logged-in user, broken down for
   * all-time plus the three caller-supplied periods. Boundaries are computed
   * client-side (in the browser's local timezone, since the server has no
   * notion of the user's timezone) and passed in as ISO timestamps.
   */
  @Get('summary')
  getSummary(
    @CurrentUser() user: User,
    @Query('dayFrom') dayFrom?: string,
    @Query('dayTo') dayTo?: string,
    @Query('weekFrom') weekFrom?: string,
    @Query('weekTo') weekTo?: string,
    @Query('monthFrom') monthFrom?: string,
    @Query('monthTo') monthTo?: string,
  ): Promise<TrackingSummaryResponse> {
    if (!dayFrom || !dayTo || !weekFrom || !weekTo || !monthFrom || !monthTo) {
      throw new BadRequestException(
        'dayFrom, dayTo, weekFrom, weekTo, monthFrom and monthTo are all required',
      );
    }
    return this.trackingService.getSummaryForUser(user.user_id, {
      day: { from: new Date(dayFrom), to: new Date(dayTo) },
      week: { from: new Date(weekFrom), to: new Date(weekTo) },
      month: { from: new Date(monthFrom), to: new Date(monthTo) },
    });
  }

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

  /**
   * PATCH /api/tracking/:id
   * Updates a tracking event. Only fields present in the body are changed.
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateTrackingEventDto,
  ): Promise<TrackingEventResponse> {
    const event = await this.trackingService.update(user.user_id, id, dto);
    return toTrackingEventResponse(event);
  }

  /** DELETE /api/tracking/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.trackingService.delete(user.user_id, id);
  }
}
