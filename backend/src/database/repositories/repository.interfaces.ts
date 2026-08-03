import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { TrackingEvent } from '../entities/tracking-event.entity';

// ── User Repository ──────────────────────────────────────────────────────────

export interface IUserRepository {
  findByGoogleId(googleId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
  create(data: Pick<User, 'email' | 'google_id' | 'display_name'>): Promise<User>;
}

// ── Project Repository ───────────────────────────────────────────────────────

export interface ProjectStats {
  project_id: string;
  name: string;
  created_at: Date;
  total_seconds: number;
  event_count: number;
}

export interface IProjectRepository {
  findAllByUser(userId: string): Promise<Project[]>;
  findByNameAndUser(name: string, userId: string): Promise<Project | null>;
  findById(projectId: string): Promise<Project | null>;
  create(data: Pick<Project, 'name' | 'user_id'>): Promise<Project>;
  update(projectId: string, name: string): Promise<Project>;
  delete(projectId: string): Promise<void>;
  getStatsForUser(userId: string): Promise<ProjectStats[]>;
}

// ── Tracking Event Repository ────────────────────────────────────────────────

export interface ITrackingEventRepository {
  findAllByUser(userId: string): Promise<TrackingEvent[]>;
  findByIdForUser(eventId: string, userId: string): Promise<TrackingEvent | null>;
  findOverlapping(
    userId: string,
    startedAt: Date,
    stoppedAt: Date,
    excludeEventId?: string,
  ): Promise<TrackingEvent | null>;
  create(data: {
    started_at: Date;
    stopped_at: Date;
    task_description?: string | null;
    project_id?: string | null;
  }): Promise<TrackingEvent>;
  update(
    eventId: string,
    data: {
      started_at: Date;
      stopped_at: Date;
      task_description: string | null;
      project_id: string | null;
    },
  ): Promise<TrackingEvent>;
  delete(eventId: string): Promise<void>;
}
