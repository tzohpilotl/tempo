import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
      // Auto-sync schema in dev; use migrations in production
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),

    AuthModule,
    ProjectsModule,
    TrackingModule,
  ],
})
export class AppModule {}
