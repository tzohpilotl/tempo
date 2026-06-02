import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import {
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
   * GET /api/tracking
   * Returns all tracking events for the logged-in user, newest first.
   * Each event includes computed duration_seconds and a project summary.
   */
  @Get()
  async findAll(@CurrentUser() user: User): Promise<TrackingEventResponse[]> {
    const events = await this.trackingService.findAllForUser(user.user_id);
    return events.map(toTrackingEventResponse);
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
