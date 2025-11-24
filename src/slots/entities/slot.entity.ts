import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { Doctor } from 'src/doctors/entities/doctor.entity';
import { Time } from 'src/times/entities/time.entity';

export enum SessionType {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
}

export enum ScheduleType {
  STREAM = 'stream',
  WAVE = 'wave',
}

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

@Entity('slots')
@Unique(['doctor', 'date', 'session'])
export class Slot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: SessionType,
  })
  session: SessionType;

  @Column({
    type: 'enum',
    enum: ScheduleType,
  })
  scheduleType: ScheduleType;

  @Column({
    type: 'enum',
    enum: DayOfWeek,
  })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'time', nullable: true })
  consultingStartTime: string;

  @Column({ type: 'time', nullable: true })
  consultingEndTime: string;

  @Column({ type: 'int', nullable: true })
  slotDuration: number;

  @Column({ type: 'int', default: 0 })
  totalCapacity: number;

  @Column({ type: 'int', default: 0 })
  currentBookings: number;

  @ManyToOne(() => Doctor, (doctor) => doctor.slots)
  doctor: Doctor;

  @OneToMany(() => Time, (time) => time.slot, { cascade: true })
  times: Time[];
}
