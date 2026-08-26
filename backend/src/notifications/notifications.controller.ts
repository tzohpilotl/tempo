import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('notifications')
@UseGuards(AuthenticatedGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** POST /api/notifications/subscribe */
  @Post('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  subscribe(@CurrentUser() user: User, @Body() dto: SubscribeDto): Promise<void> {
    return this.notifications.subscribe(user.user_id, dto);
  }

  /** POST /api/notifications/unsubscribe */
  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(@Body() dto: UnsubscribeDto): Promise<void> {
    return this.notifications.unsubscribe(dto.endpoint);
  }

  /** POST /api/notifications/test — manual smoke test for Phase 1, sends a sample push to the current user. */
  @Post('test')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendTest(@CurrentUser() user: User): Promise<void> {
    return this.notifications.sendToUser(user.user_id, {
      title: 'Tempo',
      body: "Push notifications are working — you'll get reminders like this.",
    });
  }
}
