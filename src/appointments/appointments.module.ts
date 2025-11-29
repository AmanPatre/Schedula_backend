import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Time } from 'src/times/entities/time.entity';
import { Slot } from 'src/slots/entities/slot.entity';
import { RescheduleHistory } from './entities/reschedule-history.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Doctor } from 'src/doctors/entities/doctor.entity';
// 👇 1. Import the NotificationsModule
import { NotificationsModule } from 'src/notifications/notifications.module';

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
    // 👇 2. Add it to the imports array
    NotificationsModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
