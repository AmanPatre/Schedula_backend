import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, LessThan } from 'typeorm';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/notifications/entities/notification.entity';
import {
  EngagementHistory,
  EngagementType,
} from './entities/engagement-history.entity';
import { Patient } from 'src/patients/entities/patient.entity';

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(EngagementHistory)
    private engagementRepo: Repository<EngagementHistory>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendAppointmentReminders() {
    this.logger.log('Running daily appointment reminders...');
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const upcomingAppointments = await this.appointmentRepo.find({
      where: {
        time: { slot: { date: Between(start, end) } },
      },
      relations: ['patient', 'patient.user', 'time', 'time.slot'],
    });

    for (const appt of upcomingAppointments) {
      const message = `Reminder: You have an appointment tomorrow at ${appt.time.startTime}.`;
      await this.sendNotificationAndLog(
        appt.patient,
        NotificationType.REMINDER,
        EngagementType.REMINDER,
        message,
      );
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sendWeeklyHealthTips() {
    this.logger.log('Sending weekly health tips...');
    const tips = [
      'Hydration is key! Drink at least 8 glasses of water today.',
      'Take a 15-minute walk to boost your mental clarity.',
      'Include more leafy greens in your diet this week!',
      'Good sleep improves immunity. Aim for 7-8 hours tonight.',
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    const patients = await this.patientRepo.find({ relations: ['user'] });

    for (const patient of patients) {
      if (patient.user) {
        await this.sendNotificationAndLog(
          patient,
          NotificationType.HEALTH_TIP,
          EngagementType.HEALTH_TIP,
          `Health Tip: ${randomTip}`,
        );
      }
    }
  }

  @Cron('0 0 1 * *')
  async sendFollowUpRecommendations() {
    this.logger.log('Running monthly follow-up check...');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const oldAppointments = await this.appointmentRepo.find({
      where: {
        createdAt: LessThan(sixMonthsAgo),
      },
      relations: ['patient', 'patient.user'],
    });

    const notifiedPatientIds = new Set<string>();

    for (const appt of oldAppointments) {
      const patient = appt.patient;
      if (notifiedPatientIds.has(patient.id)) continue;

      await this.sendNotificationAndLog(
        patient,
        NotificationType.FOLLOW_UP,
        EngagementType.FOLLOW_UP,
        "It's been a while! We recommend scheduling a routine check-up.",
      );

      notifiedPatientIds.add(patient.id);
    }
  }

  private async sendNotificationAndLog(
    patient: Patient,
    notifType: NotificationType,
    engageType: EngagementType,
    message: string,
  ) {
    if (!patient.user) return;

    await this.notificationsService.create(patient.user.id, notifType, message);

    const history = this.engagementRepo.create({
      patient: patient,
      type: engageType,
      content: message,
    });
    await this.engagementRepo.save(history);
  }
}
