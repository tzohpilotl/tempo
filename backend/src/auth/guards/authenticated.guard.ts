import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Apply to any route or controller that requires the user to be logged in.
 * Reads the session that Passport populates and rejects unauthenticated requests.
 *
 * e.g. @UseGuards(AuthenticatedGuard)
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.isAuthenticated()) {
      return true;
    }

    throw new UnauthorizedException('You must be logged in to access this resource');
  }
}
