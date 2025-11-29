import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngagementService } from './engagement.service';
import { EngagementHistory } from './entities/engagement-history.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Patient } from 'src/patients/entities/patient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EngagementHistory, Appointment, Patient]),
    NotificationsModule,
  ],
  providers: [EngagementService],
})
export class EngagementModule {}
