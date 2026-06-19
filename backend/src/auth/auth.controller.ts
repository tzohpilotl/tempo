import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly authService: AuthService,
  ) {}

  /**
   * GET /api/auth/test-login
   * Creates a test session without OAuth. Only works when NODE_ENV=test.
   * Used exclusively by Playwright e2e tests.
   */
  @Get('test-login')
  async testLogin(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const user = await this.authService.findOrCreateTestUser();
    await new Promise<void>((resolve, reject) =>
      req.login(user, (err: unknown) => (err ? reject(err) : resolve())),
    );
    res.json({ ok: true });
  }

  /**
   * GET /api/auth/google
   * Redirects the browser to Google's OAuth consent screen.
   * No body — the GoogleAuthGuard handles the redirect.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const user = req.user as User;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const projects = await this.projectsService.findAllForUser(user.user_id);
    const destination = projects.length > 0 ? '/dashboard' : '/onboarding';
    res.redirect(`${frontendUrl}${destination}`);
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
