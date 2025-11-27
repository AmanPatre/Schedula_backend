import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany, // <--- Ensure this is imported
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { Doctor } from 'src/doctors/entities/doctor.entity';
import { Slot, ScheduleType } from 'src/slots/entities/slot.entity';
import { Time } from 'src/times/entities/time.entity';
import { AppointmentStatus } from './appointment-status.enum';
// 👇 Import RescheduleHistory
import { RescheduleHistory } from './reschedule-history.entity';

@Entity()
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (patient) => patient.appointments)
  patient: Patient;

  @ManyToOne(() => Doctor, (doctor) => doctor.appointments)
  doctor: Doctor;

  @ManyToOne(() => Slot, (slot) => slot.appointments, { nullable: true })
  slot: Slot;

  @ManyToOne(() => Time, (time) => time.appointments, { nullable: true })
  time: Time;

  // 👇👇👇 ADDED THIS RELATIONSHIP 👇👇👇
  @OneToMany(() => RescheduleHistory, (history) => history.appointment)
  rescheduleHistory: RescheduleHistory[];

  @Column({
    type: 'enum',
    enum: ScheduleType,
    default: ScheduleType.STREAM,
  })
  scheduleType: ScheduleType;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.BOOKED,
  })
  status: AppointmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
