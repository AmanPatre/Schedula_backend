// src/times/times.module.ts

import { Module } from '@nestjs/common';
import { TimesService } from './times.service';
import { TimesController } from './times.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Time } from './entities/time.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
// 👇 Import SlotsModule
import { SlotsModule } from 'src/slots/slots.module';

@Module({
  imports: [TypeOrmModule.forFeature([Time, Appointment]), SlotsModule],
  controllers: [TimesController],
  providers: [TimesService],
})
export class TimesModule {}
