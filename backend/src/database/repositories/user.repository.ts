import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { IUserRepository } from './repository.interfaces';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly orm: Repository<User>,
  ) {}

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.orm.findOne({ where: { google_id: googleId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.orm.findOne({ where: { email } });
  }

  findById(userId: string): Promise<User | null> {
    return this.orm.findOne({ where: { user_id: userId } });
  }

  async create(data: Pick<User, 'email' | 'google_id' | 'display_name'>): Promise<User> {
    const user = this.orm.create(data);
    return this.orm.save(user);
  }
}
