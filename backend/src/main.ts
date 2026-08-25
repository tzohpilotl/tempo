import path from "node:path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import session from "express-session";
import passport from "passport";
import { ValidationPipe } from "@nestjs/common";
import connectSqlite3 from "connect-sqlite3";

const SQLiteStore = connectSqlite3(session);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error(
      "SESSION_SECRET must be set — refusing to start with a guessable default. " +
        "Generate one with: openssl rand -hex 32",
    );
  }

  // Trust one level of reverse proxy (Caddy) so secure cookies and
  // X-Forwarded-Proto work correctly behind TLS termination.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Prefix all backend routes with /api
  app.setGlobalPrefix("api");

  // Validate and transform incoming request DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Allow the React dev server to call the API during development
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true, // required for cookies/sessions
  });

  // Session middleware.
  // Sessions are persisted to a SQLite file alongside the main app database,
  // in the same Docker volume — so backend restarts/redeploys don't wipe
  // everyone's login (memorystore, used previously, kept sessions in
  // process memory only).
  const databasePath = process.env.DATABASE_PATH ?? "./data/time-tracker.sqlite";
  app.use(
    session({
      store: new SQLiteStore({
        dir: path.dirname(databasePath),
        db: "sessions.sqlite",
        table: "sessions",
      }) as session.Store,
      secret: sessionSecret,
      resave: false,
      rolling: true, // extend the cookie on each request so active use doesn't get logged out mid-session
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, refreshed by `rolling` above
        secure: process.env.NODE_ENV === "production",
        // 'lax' rather than 'strict': the Google OAuth callback is a top-level
        // cross-site redirect back to us, which 'strict' would drop the cookie on.
        // Frontend and backend are always same-origin (Vite proxy in dev, Caddy in
        // prod — see frontend/Caddyfile), so 'lax' already blocks cross-site
        // state-changing requests from riding this cookie.
        sameSite: "lax",
      },
    }),
  );

  // Passport session support
  app.use(passport.initialize());
  app.use(passport.session());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
