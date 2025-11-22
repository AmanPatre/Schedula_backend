import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { Time } from 'src/times/entities/time.entity';

@Entity('reschedule_history')
export class RescheduleHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Appointment, (appointment) => appointment.rescheduleHistory)
  appointment: Appointment;

  @ManyToOne(() => Time, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'previousTimeId' })
  previousTime: Time;

  @ManyToOne(() => Time)
  newTime: Time;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  changedAt: Date;
}
