import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngagementService } from './engagement.service';
import { EngagementHistory } from './entities/engagement-history.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EngagementHistory, Appointment]),
    NotificationsModule,
  ],
  providers: [EngagementService],
})
export class EngagementModule {}
