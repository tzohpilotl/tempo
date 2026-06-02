import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  project_id: string;

  @Column()
  name: string;

  @Column()
  user_id: string;

  @CreateDateColumn()
  created_at: Date;
}
