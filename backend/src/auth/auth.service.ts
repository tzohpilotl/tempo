import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../database/repositories/user.repository';
import { User } from '../database/entities/user.entity';

export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly users: UserRepository) {}

  /**
   * Called by the Google strategy after a successful OAuth callback.
   * Looks up the user by their Google ID; creates them if first login.
   */
  async findOrCreateUser(profile: GoogleProfile): Promise<User> {
    const allowedEmail = process.env.ALLOWED_EMAIL;
    if (allowedEmail && profile.email !== allowedEmail) {
      throw new UnauthorizedException('Access restricted to authorised users.');
    }

    const existing = await this.users.findByGoogleId(profile.googleId);
    if (existing) return existing;

    return this.users.create({
      google_id: profile.googleId,
      email: profile.email,
      display_name: profile.displayName,
    });
  }

  async findById(userId: string): Promise<User | null> {
    return this.users.findById(userId);
  }
}
