import { Slot } from 'src/slots/entities/slot.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Appointment } from 'src/appointments/entities/appointment.entity'; // <--- Import this

@Entity('times')
export class Time {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ type: 'int', default: 5 })
  capacityPerSlot: number;

  @Column({ type: 'int', default: 0 })
  currentBookings: number;

  @ManyToOne(() => Slot, (slot) => slot.times)
  slot: Slot;

  @OneToMany(() => Appointment, (appointment) => appointment.time)
  appointments: Appointment[];
}
