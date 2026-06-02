import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Apply to a route to initiate the Google OAuth flow.
 * e.g. @UseGuards(GoogleAuthGuard)
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Kicks off the OAuth redirect
    return (await super.canActivate(context)) as boolean;
  }
}
