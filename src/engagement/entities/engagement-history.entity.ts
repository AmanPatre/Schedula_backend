import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';

export enum EngagementType {
  REMINDER = 'reminder',
  HEALTH_TIP = 'health_tip',
  FOLLOW_UP = 'follow_up',
}

@Entity('engagement_history')
export class EngagementHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: EngagementType,
  })
  type: EngagementType;

  @Column()
  content: string;

  @ManyToOne(() => Patient, (patient) => patient.engagementHistory)
  patient: Patient;

  @CreateDateColumn()
  sentAt: Date;
}
