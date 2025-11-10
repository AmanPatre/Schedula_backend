import { ScheduleType, Session } from '../entities/slot.entity';

export class CreateSlotDto {
  date: Date;
  scheduleType: ScheduleType;
  session: Session;

  startTimes?: string[];
  capacityPerSlot?: number;

  consultingStartTime?: string;
  slotDuration?: number;
  totalCapacity?: number;
}
