import { IsEnum, IsUUID, IsOptional } from 'class-validator';
import { ScheduleType } from 'src/slots/entities/slot.entity';

export class CreateAppointmentDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  timeId?: string;

  @IsUUID()
  @IsOptional()
  slotId?: string;

  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;
}
