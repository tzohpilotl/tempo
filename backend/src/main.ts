import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import session from "express-session";
import passport from "passport";
import { ValidationPipe } from "@nestjs/common";
import createMemoryStore from "memorystore";

const SessionStore = createMemoryStore(session);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
  // memorystore is used here for simplicity — it prunes expired sessions
  // automatically and needs no native compilation.
  // For production on a VPS, swap this for connect-pg-simple or similar.
  app.use(
    session({
      store: new SessionStore({
        checkPeriod: 86_400_000, // prune expired sessions every 24h
      }),
      secret: process.env.SESSION_SECRET ?? "change-me-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        secure: process.env.NODE_ENV === "production",
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
