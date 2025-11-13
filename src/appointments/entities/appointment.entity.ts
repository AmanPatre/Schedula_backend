import { Doctor } from 'src/doctors/entities/doctor.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { ScheduleType } from 'src/slots/entities/slot.entity';
import { Time } from 'src/times/entities/time.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { RescheduleHistory } from './reschedule-history.entity';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: ScheduleType,
    nullable: true,
  })
  scheduleType: ScheduleType;

  @ManyToOne(() => Patient, (patient) => patient.appointments)
  patient: Patient;

  @ManyToOne(() => Doctor, (doctor) => doctor.appointments)
  doctor: Doctor;

  @ManyToOne(() => Time)
  time: Time;

  @OneToMany(() => RescheduleHistory, (history) => history.appointment)
  rescheduleHistory: RescheduleHistory[];
}
