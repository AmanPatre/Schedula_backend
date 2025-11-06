import { Slot } from 'src/slots/entities/slot.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

@Entity('times')
export class Time {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ default: true })
  isAvailable: boolean;

  @ManyToOne(() => Slot, (slot) => slot.times)
  slot: Slot;
}
