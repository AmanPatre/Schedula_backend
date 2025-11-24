import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Time } from './entities/time.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';

@Injectable()
export class TimesService {
  constructor(
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,

    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  async remove(id: string) {
    const timeSlot = await this.timeRepository.findOne({
      where: { id },
      relations: ['appointments', 'slot', 'slot.times'],
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }

    if (timeSlot.currentBookings > 0) {
      timeSlot.slot.times.sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );

      const unresolved = await this.cascadingMove(
        timeSlot.appointments,
        timeSlot,
      );

      if (unresolved.length > 0) {
        throw new ConflictException(
          `Cannot delete this time slot. ${unresolved.length} patients could not be moved to the next available time.`,
        );
      }
    }

    await this.timeRepository.remove(timeSlot);
    return { message: 'Time slot successfully deleted and patients moved.' };
  }

  private async cascadingMove(
    appointments: Appointment[],
    sourceTimeSlot: Time,
  ): Promise<Appointment[]> {
    const unresolved: Appointment[] = [];
    const allTimes = sourceTimeSlot.slot.times;

    const sourceIndex = allTimes.findIndex((t) => t.id === sourceTimeSlot.id);

    if (sourceIndex === -1 || sourceIndex === allTimes.length - 1) {
      return appointments;
    }

    for (const appointment of appointments) {
      let isResolved = false;

      for (let i = sourceIndex + 1; i < allTimes.length; i++) {
        const targetSlot = allTimes[i];

        if (targetSlot.currentBookings < targetSlot.capacityPerSlot) {
          appointment.time = targetSlot;
          await this.appointmentRepository.save(appointment);

          targetSlot.currentBookings += 1;
          targetSlot.isAvailable =
            targetSlot.currentBookings < targetSlot.capacityPerSlot;
          await this.timeRepository.save(targetSlot);

          isResolved = true;
          break;
        }
      }

      if (!isResolved) {
        unresolved.push(appointment);
      }
    }

    return unresolved;
  }

  create(dto: any) {
    return 'not implemented';
  }
  findAll() {
    return 'not implemented';
  }
  findOne(id: number) {
    return 'not implemented';
  }
  update(id: number, dto: any) {
    return 'not implemented';
  }
}
