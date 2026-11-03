import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('tracking_events')
export class TrackingEvent {
  @PrimaryGeneratedColumn('uuid')
  tracking_event_id: string;

  @Column({ type: 'datetime' })
  started_at: Date;

  @Column({ type: 'datetime' })
  stopped_at: Date;

  @Column({ type: 'text', nullable: true })
  task_description: string | null;

  @Column({ nullable: true })
  project_id: string | null;

  /** Accumulated time the session was paused, in seconds — subtracted from the raw
   *  started_at/stopped_at interval everywhere duration is computed. */
  @Column({ type: 'int', default: 0 })
  paused_seconds: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;
}
