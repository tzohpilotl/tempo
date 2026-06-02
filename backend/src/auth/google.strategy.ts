import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback, Profile } from "passport-google-oauth20";
import { AuthService } from "./auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly authService: AuthService) {
    console.log("heolol", process.env.GOOGLE_CALLBACK_URL);
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // This URL must be registered in the Google Cloud Console
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        "http://localhost:3000/api/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  /**
   * Passport calls this after Google redirects back with a valid token.
   * We extract the profile fields we care about and delegate to AuthService.
   */
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;

      if (!email) {
        return done(new Error("No email returned from Google"), undefined);
      }

      const user = await this.authService.findOrCreateUser({
        googleId: profile.id,
        email,
        displayName: profile.displayName ?? email,
      });

      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
