import { Doctor } from 'src/doctors/entities/doctor.entity';
import { Time } from 'src/times/entities/time.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';

export enum Session {
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
export class Slot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: Session,
    nullable: true,
  })
  session: Session;

  @Column({
    type: 'enum',
    enum: ScheduleType,
    nullable: true,
  })
  scheduleType: ScheduleType;

  @Column({
    type: 'enum',
    enum: DayOfWeek,
    nullable: true,
  })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'time', nullable: true })
  consultingStartTime: string;

  @Column({ type: 'int', nullable: true })
  slotDuration: number;

  @Column({ type: 'int', default: 0 })
  currentBookings: number;

  @Column({ type: 'int', nullable: true })
  totalCapacity: number;

  @ManyToOne(() => Doctor, (doctor) => doctor.slots)
  doctor: Doctor;

  @OneToMany(() => Time, (time) => time.slot)
  times: Time[];
}
