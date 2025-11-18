import { DayOfWeek, ScheduleType, Session } from '../entities/slot.entity';

export class CreateSlotDto {
  startDate: Date;
  endDate: Date;
  session: Session;
  scheduleType: ScheduleType;
  daysOfWeek: DayOfWeek[];

  // Wave properties
  startTimes?: string[];
  capacityPerSlot?: number;

  // Stream properties
  consultingStartTime?: string;
  slotDuration?: number;
  totalCapacity?: number;
}
