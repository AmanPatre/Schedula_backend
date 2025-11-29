import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/notifications/entities/notification.entity';
import {
  EngagementHistory,
  EngagementType,
} from './entities/engagement-history.entity';

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(EngagementHistory)
    private engagementRepo: Repository<EngagementHistory>,
    private notificationsService: NotificationsService,
  ) {}

  // ⏰ Runs every day at 8:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendAppointmentReminders() {
    this.logger.log('Running daily appointment reminders...');

    // 1. Calculate "Tomorrow" range
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    // 2. Find appointments scheduled for tomorrow
    const upcomingAppointments = await this.appointmentRepo.find({
      where: {
        time: {
          // We filter based on the Slot date because 'Time' usually just has HH:MM
          slot: { date: Between(start, end) },
        },
      },
      relations: ['patient', 'patient.user', 'time', 'time.slot'],
    });

    // 3. Send Notifications
    for (const appt of upcomingAppointments) {
      const message = `Reminder: You have an appointment tomorrow at ${appt.time.startTime}.`;

      // Send Alert
      await this.notificationsService.create(
        appt.patient.user.id,
        NotificationType.REMINDER,
        message,
      );

      // Log History
      const history = this.engagementRepo.create({
        patient: appt.patient,
        type: EngagementType.REMINDER,
        content: message,
      });
      await this.engagementRepo.save(history);

      this.logger.log(`Reminder sent to patient ${appt.patient.id}`);
    }
  }
}
