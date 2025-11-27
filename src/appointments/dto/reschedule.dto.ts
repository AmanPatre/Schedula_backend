import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  IsOptional, // Added
} from 'class-validator';

export class RescheduleBaseDto {
  @IsInt()
  @IsNotEmpty()
  @Max(180, { message: 'Cannot shift by more than 3 hours' })
  @Min(-180, { message: 'Cannot shift by more than 3 hours' })
  @ValidateIf((o) => o.shift_minutes > 10 || o.shift_minutes < -10, {
    message: 'Shift must be at least 10 minutes',
  })
  shift_minutes: number;
}

export class RescheduleSelectedDto extends RescheduleBaseDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  appointment_ids: string[];
}

export class RescheduleAllDto extends RescheduleBaseDto {
  @IsOptional()
  @IsUUID()
  slotId?: string;
}
