import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Time } from 'src/times/entities/time.entity';
import { Slot } from 'src/slots/entities/slot.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { RescheduleHistory } from './entities/reschedule-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Time,
      Slot,
      Patient,
      RescheduleHistory,
    ]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
