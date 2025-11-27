import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Time } from 'src/times/entities/time.entity';
import { Slot } from 'src/slots/entities/slot.entity';
import { RescheduleHistory } from './entities/reschedule-history.entity';
import { Patient } from 'src/patients/entities/patient.entity';
// 👇👇👇 ADD THIS IMPORT 👇👇👇
import { Doctor } from 'src/doctors/entities/doctor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Time,
      Slot,
      RescheduleHistory,
      Patient,

      Doctor,
    ]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  // Exporting it is good practice if other modules need to use AppointmentsService
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
