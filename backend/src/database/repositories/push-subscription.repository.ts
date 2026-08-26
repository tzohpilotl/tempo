import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from '../entities/push-subscription.entity';
import { IPushSubscriptionRepository } from './repository.interfaces';

@Injectable()
export class PushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly orm: Repository<PushSubscription>,
  ) {}

  findAllByUser(userId: string): Promise<PushSubscription[]> {
    return this.orm.find({ where: { user_id: userId } });
  }

  findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    return this.orm.findOne({ where: { endpoint } });
  }

  async upsert(data: {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }): Promise<PushSubscription> {
    const existing = await this.findByEndpoint(data.endpoint);
    if (existing) {
      await this.orm.update({ endpoint: data.endpoint }, data);
      return this.orm.findOneOrFail({ where: { endpoint: data.endpoint } });
    }
    const subscription = this.orm.create(data);
    return this.orm.save(subscription);
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.orm.delete({ endpoint });
  }
}
