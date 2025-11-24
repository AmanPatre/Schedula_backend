import {
  IsEnum,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  IsOptional,
  Matches,
  ValidateIf,
  IsString,
} from 'class-validator';
import { SessionType, ScheduleType, DayOfWeek } from '../entities/slot.entity';

export class CreateSlotDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(SessionType)
  session: SessionType;

  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  daysOfWeek: DayOfWeek[];

  @ValidateIf((o) => o.scheduleType === ScheduleType.WAVE)
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'consultingStartTime must be in HH:MM format (e.g., 09:00)',
  })
  consultingStartTime: string;

  @ValidateIf((o) => o.scheduleType === ScheduleType.WAVE)
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'consultingEndTime must be in HH:MM format (e.g., 12:00)',
  })
  consultingEndTime: string;

  @ValidateIf((o) => o.scheduleType === ScheduleType.WAVE)
  @IsArray()
  @IsString({ each: true })
  startTimes: string[];

  @ValidateIf((o) => o.scheduleType === ScheduleType.WAVE)
  @IsInt()
  @Min(1)
  slotDuration: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalCapacity?: number;

  @ValidateIf((o) => o.scheduleType === ScheduleType.WAVE)
  @IsInt()
  @Min(1)
  capacityPerSlot?: number;
}
