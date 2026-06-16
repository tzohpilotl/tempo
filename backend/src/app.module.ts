import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { TrackingModule } from './tracking/tracking.module';
import { User } from './database/entities/user.entity';
import { Project } from './database/entities/project.entity';
import { TrackingEvent } from './database/entities/tracking-event.entity';
import { HealthController } from './common/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    // Loads .env into process.env before any other module reads it.
    // envFilePath tries the project root first (local dev), then backend/ (Docker/CI).
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),

    // Database — SQLite for local dev, easily swapped via env for VPS
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH ?? './data/time-tracker.sqlite',
      entities: [User, Project, TrackingEvent],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),

    // Global rate limiting: 100 requests per minute per IP.
    // Auth routes override this with a stricter 10/min limit.
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60_000,
      limit: 100,
    }]),

    AuthModule,
    ProjectsModule,
    TrackingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
