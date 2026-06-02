import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingEvent } from '../database/entities/tracking-event.entity';
import { TrackingEventRepository } from '../database/repositories/tracking-event.repository';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingEvent]),
    // Import ProjectsModule to access ProjectRepository for ownership checks
    ProjectsModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingEventRepository],
})
export class TrackingModule {}
