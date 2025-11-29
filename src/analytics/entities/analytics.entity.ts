import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Appointment } from 'src/appointments/entities/appointment.entity'; //

@Entity('analytics')
export class Analytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Appointment)
  @JoinColumn()
  appointment: Appointment;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  recordedAt: Date;
}
