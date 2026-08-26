import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { PushSubscriptionRepository } from '../database/repositories/push-subscription.repository';
import { SubscribeDto } from './dto/subscribe.dto';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
    config: ConfigService,
  ) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    const subject = config.get<string>('VAPID_SUBJECT');

    // Push notifications are opt-in and non-essential, so a missing VAPID
    // config disables sending (logged once) rather than failing app startup
    // the way a missing SESSION_SECRET does.
    if (publicKey && privateKey && subject) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT not fully configured — push notifications are disabled',
      );
    }
  }

  async subscribe(userId: string, dto: SubscribeDto): Promise<void> {
    await this.subscriptions.upsert({
      user_id: userId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.subscriptions.deleteByEndpoint(endpoint);
  }

  /** Sends to every subscription the user has (e.g. multiple devices/browsers). */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const subs = await this.subscriptions.findAllByUser(userId);
    await Promise.all(subs.map((sub) => this.send(sub, payload)));
  }

  private async send(
    sub: { endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410: the browser/OS has permanently invalidated this subscription
      // (uninstall, permission revoked, endpoint expired) — nothing will ever
      // succeed again, so prune it. Any other error (e.g. a transient 5xx from
      // the push service) is just logged; the subscription may still be good.
      if (status === 404 || status === 410) {
        await this.subscriptions.deleteByEndpoint(sub.endpoint);
      } else {
        this.logger.error(`Failed to send push notification: ${(err as Error).message}`);
      }
    }
  }
}
