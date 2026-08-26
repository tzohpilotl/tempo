import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushSubscription } from '../database/entities/push-subscription.entity';
import { PushSubscriptionRepository } from '../database/repositories/push-subscription.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushSubscriptionRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
