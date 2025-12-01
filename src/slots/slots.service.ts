import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Slot, DayOfWeek, ScheduleType } from './entities/slot.entity';
import { In, Repository, Between, Not } from 'typeorm';
import { Doctor } from 'src/doctors/entities/doctor.entity';
import { Time } from 'src/times/entities/time.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(Slot)
    private slotRepository: Repository<Slot>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  async create(createSlotDto: CreateSlotDto, userId: string): Promise<any> {
    const doctor = await this.doctorRepository.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found for this user.');
    }

    const { startDate, endDate, daysOfWeek } = createSlotDto;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      throw new BadRequestException(
        'You cannot set availability for past dates.',
      );
    }

    if (end < start) {
      throw new BadRequestException('End date cannot be before start date.');
    }

    const sixMonthsLater = new Date(start);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    if (end > sixMonthsLater) {
      throw new BadRequestException(
        'You can only set availability for up to 6 months in advance.',
      );
    }

    // Keep existing check for startTimes presence
    if (
      createSlotDto.scheduleType === ScheduleType.WAVE &&
      (!createSlotDto.startTimes || createSlotDto.startTimes.length === 0)
    ) {
      throw new BadRequestException(
        'For Wave scheduling, you must provide at least one start time.',
      );
    }

    // vvv NEW VALIDATION BLOCK vvv
    // Ensure startTimes fall within the new consultingStartTime/EndTime boundaries
    if (createSlotDto.scheduleType === ScheduleType.WAVE) {
      const { consultingStartTime, consultingEndTime, startTimes } =
        createSlotDto;

      if (!consultingStartTime || !consultingEndTime) {
        throw new BadRequestException(
          'Wave schedules require both start and end time boundaries.',
        );
      }
      if (consultingStartTime >= consultingEndTime) {
        throw new BadRequestException(
          'Session start time must be before end time.',
        );
      }

      for (const specificTime of startTimes) {
        // String comparison works correctly for HH:MM:SS format
        if (
          specificTime < consultingStartTime ||
          specificTime >= consultingEndTime
        ) {
          throw new BadRequestException(
            `Invalid start time list: '${specificTime}' is outside the session boundaries (${consultingStartTime} - ${consultingEndTime}).`,
          );
        }
      }
    }
    // ^^^ END NEW VALIDATION BLOCK ^^^

    const loopDate = new Date(start);
    const createdSlots: Slot[] = [];

    while (loopDate <= end) {
      const currentDayOfWeek = loopDate.getDay() as DayOfWeek;

      if (daysOfWeek.includes(currentDayOfWeek)) {
        const existingSlot = await this.slotRepository.findOne({
          where: {
            doctor: { id: doctor.id },
            date: new Date(loopDate),
            session: createSlotDto.session,
          },
        });

        if (existingSlot) {
          throw new ConflictException(
            `A slot already exists for ${loopDate.toDateString()} in the ${createSlotDto.session}.`,
          );
        }

        const newSlot = this.slotRepository.create({
          date: new Date(loopDate),
          doctor: doctor,
          session: createSlotDto.session,
          scheduleType: createSlotDto.scheduleType,
          dayOfWeek: currentDayOfWeek,
          // vvv Save new boundary fields vvv
          consultingStartTime: createSlotDto.consultingStartTime,
          consultingEndTime: createSlotDto.consultingEndTime,
          // ^^^
          slotDuration: createSlotDto.slotDuration,
          totalCapacity: createSlotDto.totalCapacity,
        });
        await this.slotRepository.save(newSlot);
        createdSlots.push(newSlot);

        // vvv EXISTING LOGIC REMAINS UNTOUCHED vvv
        if (
          createSlotDto.scheduleType === ScheduleType.WAVE &&
          createSlotDto.startTimes
        ) {
          const timePromises = createSlotDto.startTimes.map((time) => {
            const newTime = this.timeRepository.create({
              startTime: time,
              isAvailable: true,
              slot: newSlot,
              capacityPerSlot: createSlotDto.capacityPerSlot,
            });
            return this.timeRepository.save(newTime);
          });
          await Promise.all(timePromises);
        }
        // ^^^
      }
      loopDate.setDate(loopDate.getDate() + 1);
    }

    return {
      message: `Successfully created ${createdSlots.length} recurring slots.`,
    };
  }

  async findAvailableSlotsForDoctor(doctorId: string, date: string) {
    const slots = await this.slotRepository.find({
      where: {
        doctor: { id: doctorId },
        date: new Date(date),
      },
    });

    if (!slots || slots.length === 0) {
      throw new NotFoundException(
        'No availability found for this doctor on this date.',
      );
    }

    const response: any[] = [];
    for (const slot of slots) {
      if (slot.scheduleType === 'stream') {
        if (slot.currentBookings < slot.totalCapacity) {
          response.push({
            scheduleType: 'stream',
            slot: slot,
          });
        }
      }

      if (slot.scheduleType === 'wave') {
        const availableTimes = await this.timeRepository.find({
          where: {
            slot: { id: slot.id },
            isAvailable: true,
          },
          order: {
            startTime: 'ASC',
          },
        });

        if (availableTimes.length > 0) {
          response.push({
            scheduleType: 'wave',
            slotId: slot.id,
            availableTimes: availableTimes,
          });
        }
      }
    }

    if (response.length === 0) {
      throw new NotFoundException(
        'All slots for this doctor on this date are fully booked.',
      );
    }

    return response;
  }

  async update(id: string, updateSlotDto: UpdateSlotDto) {
    const slot = await this.slotRepository.findOne({
      where: { id },
      relations: ['times', 'times.appointments', 'doctor'],
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    const affectedAppointments = await this.getAffectedAppointments(
      slot,
      updateSlotDto,
    );

    if (affectedAppointments.length > 0) {
      const unresolvedAppointments = await this.resolveConflicts(
        affectedAppointments,
        slot,
      );

      if (unresolvedAppointments.length > 0) {
        throw new ConflictException(
          `Update failed. ${unresolvedAppointments.length} patients could not be automatically moved. Please manually reschedule them.`,
        );
      }
    }

    Object.assign(slot, updateSlotDto);

    if (
      slot.scheduleType === 'wave' &&
      updateSlotDto.capacityPerSlot !== undefined
    ) {
      if (slot.times) {
        for (const time of slot.times) {
          time.capacityPerSlot = updateSlotDto.capacityPerSlot;
          await this.timeRepository.save(time);
        }
      }
    }

    return this.slotRepository.save(slot);
  }

  async updateTimeSlot(timeId: string, newCapacity: number) {
    const timeSlot = await this.timeRepository.findOne({
      where: { id: timeId },
      relations: ['slot', 'slot.times'],
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }

    if (timeSlot.slot.scheduleType !== ScheduleType.WAVE) {
      throw new BadRequestException(
        'This endpoint is only for Wave schedules.',
      );
    }

    timeSlot.slot.times.sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (newCapacity < timeSlot.currentBookings) {
      const appointments = await this.appointmentRepository.find({
        where: { time: { id: timeId } },
        order: { createdAt: 'ASC' },
      });

      const excessCount = timeSlot.currentBookings - newCapacity;
      const appointmentsToMove = appointments.slice(-excessCount);

      const unresolved = await this.cascadingWaveMove(
        appointmentsToMove,
        timeSlot,
      );

      if (unresolved.length > 0) {
        throw new ConflictException(
          `Update failed. ${unresolved.length} patients could not be moved to the next available time slot in this session.`,
        );
      }

      timeSlot.currentBookings -= appointmentsToMove.length;
    }

    timeSlot.capacityPerSlot = newCapacity;
    timeSlot.isAvailable = timeSlot.currentBookings < timeSlot.capacityPerSlot;

    return this.timeRepository.save(timeSlot);
  }

  private async getAffectedAppointments(
    slot: Slot,
    dto: UpdateSlotDto,
  ): Promise<Appointment[]> {
    let affected: Appointment[] = [];

    if (
      slot.scheduleType === 'stream' &&
      dto.totalCapacity !== undefined &&
      dto.totalCapacity < slot.currentBookings
    ) {
      const bookings = await this.appointmentRepository.find({
        where: { time: { slot: { id: slot.id } } },
        order: { createdAt: 'ASC' },
        relations: ['time', 'time.slot'],
      });

      const excessCount = slot.currentBookings - dto.totalCapacity;
      affected = bookings.slice(-excessCount);
    }

    if (slot.scheduleType === 'wave' && dto.capacityPerSlot !== undefined) {
      for (const time of slot.times) {
        if (time.currentBookings > dto.capacityPerSlot) {
          const timeBookings = await this.appointmentRepository.find({
            where: { time: { id: time.id } },
            order: { createdAt: 'ASC' },
            relations: ['time'],
          });
          const excess = time.currentBookings - dto.capacityPerSlot;
          affected.push(...timeBookings.slice(-excess));
        }
      }
    }

    if (
      (dto.consultingStartTime &&
        dto.consultingStartTime !== slot.consultingStartTime) ||
      (dto.slotDuration && dto.slotDuration !== slot.slotDuration)
    ) {
      const allBookings = await this.appointmentRepository.find({
        where: { time: { slot: { id: slot.id } } },
        relations: ['time', 'time.slot'],
      });
      affected = allBookings;
    }

    return affected;
  }

  private async resolveConflicts(
    appointments: Appointment[],
    originalSlot: Slot,
  ): Promise<Appointment[]> {
    const unresolved: Appointment[] = [];

    const startDate = new Date(originalSlot.date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    const targetSlots = await this.slotRepository.find({
      where: {
        doctor: { id: originalSlot.doctor.id },
        date: Between(startDate, endDate),
        id: Not(originalSlot.id),
      },
      order: {
        date: 'ASC',
        consultingStartTime: 'ASC',
      },
      relations: ['times'],
    });

    for (const appointment of appointments) {
      let isResolved = false;

      for (const targetSlot of targetSlots) {
        if (
          targetSlot.scheduleType === 'stream' &&
          targetSlot.currentBookings < targetSlot.totalCapacity
        ) {
          const minutesToAdd =
            targetSlot.slotDuration * targetSlot.currentBookings;
          if (!targetSlot.consultingStartTime) continue;

          const [h, m] = targetSlot.consultingStartTime.split(':').map(Number);
          const newStart = new Date(targetSlot.date);
          newStart.setHours(h, m + minutesToAdd);
          const timeString = newStart.toTimeString().split(' ')[0];

          const newTime = this.timeRepository.create({
            startTime: timeString,
            isAvailable: false,
            capacityPerSlot: 1,
            currentBookings: 1,
            slot: targetSlot,
          });
          await this.timeRepository.save(newTime);

          appointment.time = newTime;
          appointment.scheduleType = ScheduleType.STREAM;
          await this.appointmentRepository.save(appointment);

          targetSlot.currentBookings += 1;
          await this.slotRepository.save(targetSlot);

          originalSlot.currentBookings -= 1;

          isResolved = true;
          break;
        }

        if (targetSlot.scheduleType === 'wave') {
          const availableTime = targetSlot.times.find(
            (t) => t.currentBookings < t.capacityPerSlot,
          );

          if (availableTime) {
            appointment.time = availableTime;
            appointment.scheduleType = ScheduleType.WAVE;
            await this.appointmentRepository.save(appointment);

            availableTime.currentBookings += 1;
            if (
              availableTime.currentBookings >= availableTime.capacityPerSlot
            ) {
              availableTime.isAvailable = false;
            }
            await this.timeRepository.save(availableTime);

            originalSlot.currentBookings -= 1;

            isResolved = true;
            break;
          }
        }
      }

      if (!isResolved) {
        unresolved.push(appointment);
      }
    }

    return unresolved;
  }

  private async cascadingWaveMove(
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

  async remove(id: string) {
    const slot = await this.slotRepository.findOne({
      where: { id },
      relations: ['times', 'times.appointments', 'doctor'],
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    const appointmentsToMove = await this.appointmentRepository.find({
      where: { time: { slot: { id: slot.id } } },
      relations: ['time', 'time.slot', 'patient', 'doctor'],
    });

    if (appointmentsToMove.length > 0) {
      const unresolved = await this.resolveConflicts(appointmentsToMove, slot);

      if (unresolved.length > 0) {
        throw new ConflictException(
          `Cannot delete slot. ${unresolved.length} patients could not be automatically moved. Please manually reschedule them first.`,
        );
      }
    }

    if (slot.times && slot.times.length > 0) {
      await this.timeRepository.remove(slot.times);
    }

    await this.slotRepository.remove(slot);
    return { message: 'Slot successfully deleted and patients moved.' };
  }

  findAll() {
    return `This action returns all slots`;
  }

  findOne(id: string) {
    return `This action returns a #${id} slot`;
  }
}
