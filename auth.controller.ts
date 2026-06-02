import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('auth')
export class AuthController {
  /**
   * GET /api/auth/google
   * Redirects the browser to Google's OAuth consent screen.
   * No body — the GoogleAuthGuard handles the redirect.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // Guard handles the redirect; this body never executes
  }

  /**
   * GET /api/auth/google/callback
   * Google redirects here after the user grants access.
   * Passport validates the token, calls our strategy's validate(),
   * which calls AuthService.findOrCreateUser() and sets req.user.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    // At this point req.user is populated and the session cookie has been set.
    // Redirect to onboarding; the frontend will decide where to send the user.
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    res.redirect(`${frontendUrl}/onboarding`);
  }

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user's data.
   * Used by the frontend to check session state on page load.
   */
  @Get('me')
  @UseGuards(AuthenticatedGuard)
  getMe(@CurrentUser() user: User): Omit<User, 'google_id'> {
    // Never expose the google_id to the client
    const { google_id: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * POST /api/auth/logout
   * Destroys the server-side session and clears the cookie.
   */
  @Get('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request, @Res() res: Response): void {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login`);
      });
    });
  }
}
