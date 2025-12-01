import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimesService } from './times.service';

import { TimesController } from './times.controller';
import { Time } from './entities/time.entity';

import { Appointment } from 'src/appointments/entities/appointment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Time, Appointment])],
  controllers: [TimesController],
  providers: [TimesService],
})
export class TimesModule {}
