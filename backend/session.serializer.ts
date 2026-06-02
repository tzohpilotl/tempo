import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { User } from '../database/entities/user.entity';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  /**
   * What gets written into the session store.
   * We only persist the user_id — everything else is fetched fresh on each request.
   */
  serializeUser(user: User, done: (err: unknown, id: string) => void): void {
    done(null, user.user_id);
  }

  /**
   * Called on every authenticated request to hydrate req.user from the session.
   * Returns null if the user has been deleted since the session was created.
   */
  async deserializeUser(
    userId: string,
    done: (err: unknown, user: User | null) => void,
  ): Promise<void> {
    try {
      const user = await this.authService.findById(userId);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
}
