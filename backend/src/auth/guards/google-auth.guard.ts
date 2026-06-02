import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Apply to a route to initiate the Google OAuth flow.
 * e.g. @UseGuards(GoogleAuthGuard)
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activate = (await super.canActivate(context)) as boolean;
    // super.canActivate authenticates but never calls req.logIn() — we must do
    // it explicitly so Passport serializes the user into the session store.
    // This only runs on the callback route (when activate is true and req.user
    // is populated); the initial /auth/google redirect route throws before here.
    const request = context.switchToHttp().getRequest();
    await super.logIn(request);
    return activate;
  }
}
