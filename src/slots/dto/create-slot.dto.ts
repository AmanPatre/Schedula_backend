import { DayOfWeek, ScheduleType, Session } from '../entities/slot.entity';

export class CreateSlotDto {
  date: Date;
  session: Session;
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;

  // Wave properties
  startTimes?: string[];
  capacityPerSlot?: number;

  // Stream properties
  consultingStartTime?: string;
  slotDuration?: number;
  totalCapacity?: number;
}
