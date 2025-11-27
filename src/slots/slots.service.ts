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

    if (
      createSlotDto.scheduleType === ScheduleType.WAVE &&
      (!createSlotDto.startTimes || createSlotDto.startTimes.length === 0)
    ) {
      throw new BadRequestException(
        'For Wave scheduling, you must provide at least one start time.',
      );
    }

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
          consultingStartTime: createSlotDto.consultingStartTime,
          consultingEndTime: createSlotDto.consultingEndTime,
          slotDuration: createSlotDto.slotDuration,
          totalCapacity: createSlotDto.totalCapacity,
        });
        await this.slotRepository.save(newSlot);
        createdSlots.push(newSlot);

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
      }
      loopDate.setDate(loopDate.getDate() + 1);
    }

    return {
      message: `Successfully created ${createdSlots.length} recurring slots.`,
      data: createdSlots,
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
      // IMPORTANT: We need appointments here to move them, but it causes stale data issues later.
      relations: ['times', 'times.appointments', 'doctor'],
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    // 1. Identify affected patients and mark invalid times for _toBeDeleted
    const affectedAppointments = await this.getAffectedAppointments(
      slot,
      updateSlotDto,
    );

    // 2. Move the patients in the DB
    if (affectedAppointments.length > 0) {
      const unresolvedAppointments = await this.resolveConflicts(
        affectedAppointments,
        slot,
      );

      if (unresolvedAppointments.length > 0) {
        throw new ConflictException(
          `Update failed. ${unresolvedAppointments.length} patients falling outside the new boundaries could not be automatically moved.`,
        );
      }
    }

    // 3. Cleanup: Delete Wave Time entities that are now invalid
    if (slot.scheduleType === ScheduleType.WAVE && slot.times) {
      const timesToDelete = slot.times.filter(
        (t) => (t as any)._toBeDeleted === true,
      );

      if (timesToDelete.length > 0) {
        // ▼▼▼▼▼▼ FIX: Use .delete() with IDs instead of .remove() ▼▼▼▼▼▼
        // This forces a raw delete in the DB and avoids TypeORM relation confusion.
        const idsToDelete = timesToDelete.map((t) => t.id);
        await this.timeRepository.delete(idsToDelete);

        // CRITICAL: Remove them from the in-memory slot object so the final save doesn't try to resurrect them.
        slot.times = slot.times.filter((t) => !(t as any)._toBeDeleted);
        // ▲▲▲▲▲▲ FIX ENDS HERE ▲▲▲▲▲▲
      }
    }

    // 4. Apply updates to parent slot properties
    Object.assign(slot, updateSlotDto);

    // 5. Handle capacityPerSlot update for remaining valid Wave times
    if (
      slot.scheduleType === 'wave' &&
      updateSlotDto.capacityPerSlot !== undefined &&
      slot.times
    ) {
      for (const time of slot.times) {
        time.capacityPerSlot = updateSlotDto.capacityPerSlot;
        // Recalculate availability based on bookings (Note: these are stale in-memory bookings, but safe for capacity checks)
        time.isAvailable = time.currentBookings < time.capacityPerSlot;
        await this.timeRepository.save(time);
      }
    }

    // Final save of the parent slot
    await this.slotRepository.save(slot);

    // ▼▼▼▼▼▼ FIX: RELOAD FROM DB BEFORE RETURNING ▼▼▼▼▼▼
    // DO NOT return the result of save() directly. It can contain stale relationship data.
    // Instead, fetch the "source of truth" fresh from the database.
    const updatedSlot = await this.slotRepository.findOne({
      where: { id: slot.id },
      relations: ['times'], // Reload times to confirm deletions happened
      order: {
        times: { startTime: 'ASC' }, // Keep nicely ordered
      },
    });

    return updatedSlot;
    // ▲▲▲▲▲▲ FIX ENDS HERE ▲▲▲▲▲▲
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

  // New method to handle deleting a specific Wave time slot with escalation
  async deleteTimeSlot(timeId: string) {
    // 1. Find the time slot with all needed relations
    const timeSlot = await this.timeRepository.findOne({
      where: { id: timeId },
      relations: ['slot', 'slot.times', 'slot.doctor', 'appointments'],
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }

    if (timeSlot.slot.scheduleType !== ScheduleType.WAVE) {
      throw new BadRequestException(
        'Only Wave time slots can be deleted individually.',
      );
    }

    // Ensure times are sorted so cascading works correctly
    timeSlot.slot.times.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const appointmentsToMove = timeSlot.appointments;

    if (appointmentsToMove.length > 0) {
      // Strategy 1: Try a small Cascading Move (same session)
      let unresolved = await this.cascadingWaveMove(
        appointmentsToMove,
        timeSlot,
      );

      // Strategy 2: If Cascade failed, escalate to Waterfall Move (diff session/day)
      if (unresolved.length > 0) {
        // We pass the parent slot so it knows the doctor and date context
        unresolved = await this.resolveConflicts(unresolved, timeSlot.slot);
      }

      // If Waterfall also failed, we cannot delete
      if (unresolved.length > 0) {
        throw new ConflictException(
          `Cannot delete this time slot. ${unresolved.length} patients could not be moved to any available time (in this session or future sessions).`,
        );
      }
    }

    // If we got here, all patients are moved. Delete the time slot.
    await this.timeRepository.remove(timeSlot);
    return {
      message: 'Time slot deleted and patients successfully rescheduled.',
    };
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
      if (slot.times) {
        for (const time of slot.times) {
          if (time.currentBookings > dto.capacityPerSlot) {
            const excess = time.currentBookings - dto.capacityPerSlot;
            affected.push(...time.appointments.slice(-excess));
          }
        }
      }
    }

    const newStartTimeStr = dto.consultingStartTime ?? slot.consultingStartTime;
    const newEndTimeStr = dto.consultingEndTime ?? slot.consultingEndTime;
    const newDuration = dto.slotDuration ?? slot.slotDuration;

    const isTimeChange =
      newStartTimeStr !== slot.consultingStartTime ||
      newEndTimeStr !== slot.consultingEndTime;
    const isDurationChange = newDuration !== slot.slotDuration;

    if (isDurationChange) {
      if (slot.times) {
        slot.times.forEach((t) => {
          affected.push(...t.appointments);
          (t as any)._toBeDeleted = true;
        });
      } else {
        const allBookings = await this.appointmentRepository.find({
          where: { time: { slot: { id: slot.id } } },
          relations: ['time', 'time.slot'],
        });
        affected.push(...allBookings);
      }
      return [...new Set(affected)];
    }

    if (isTimeChange) {
      const H = '1970-01-01T';
      const newStart = new Date(H + newStartTimeStr);
      const newEnd = new Date(H + newEndTimeStr);

      if (slot.scheduleType === ScheduleType.WAVE && slot.times) {
        for (const time of slot.times) {
          const timeStart = new Date(H + time.startTime);
          const timeEnd = new Date(
            timeStart.getTime() + slot.slotDuration * 60000,
          );

          if (timeStart < newStart || timeEnd > newEnd) {
            affected.push(...time.appointments);
            (time as any)._toBeDeleted = true;
          }
        }
      }

      if (slot.scheduleType === ScheduleType.STREAM) {
        let streamBookings = affected;
        if (streamBookings.length === 0 && slot.currentBookings > 0) {
          streamBookings = await this.appointmentRepository.find({
            where: { time: { slot: { id: slot.id } } },
            relations: ['time'],
          });
        }

        for (const booking of streamBookings) {
          const bookingStart = new Date(H + booking.time.startTime);
          const bookingEnd = new Date(
            bookingStart.getTime() + slot.slotDuration * 60000,
          );

          if (bookingStart < newStart || bookingEnd > newEnd) {
            if (!affected.find((a) => a.id === booking.id)) {
              affected.push(booking);
            }
          }
        }
      }
    }

    return [...new Set(affected)];
  }

  private async resolveConflicts(
    appointments: Appointment[],
    originalSlot: Slot,
  ): Promise<Appointment[]> {
    const unresolved: Appointment[] = [];

    const startDate = new Date(originalSlot.date);
    startDate.setHours(
      parseInt(originalSlot.consultingStartTime.split(':')[0]),
      parseInt(originalSlot.consultingStartTime.split(':')[1]),
    );

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
        if (targetSlot.scheduleType === 'stream') {
          // Priority Squeezing: <= instead of <
          if (targetSlot.currentBookings <= targetSlot.totalCapacity) {
            const minutesToAdd =
              targetSlot.slotDuration * targetSlot.currentBookings;
            if (!targetSlot.consultingStartTime) continue;

            const [h, m] = targetSlot.consultingStartTime
              .split(':')
              .map(Number);
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
        }

        if (targetSlot.scheduleType === 'wave' && targetSlot.times) {
          // Ensure times are sorted before searching
          targetSlot.times.sort((a, b) =>
            a.startTime.localeCompare(b.startTime),
          );

          // Priority Search Step 1: Find open slot
          let targetTime = targetSlot.times.find(
            (t) => t.currentBookings < t.capacityPerSlot,
          );

          // Priority Search Step 2: Find exactly full slot to squeeze in
          if (!targetTime) {
            targetTime = targetSlot.times.find(
              (t) => t.currentBookings === t.capacityPerSlot,
            );
          }

          if (targetTime) {
            appointment.time = targetTime;
            appointment.scheduleType = ScheduleType.WAVE;
            await this.appointmentRepository.save(appointment);

            targetTime.currentBookings += 1;
            // FIXED: Only mark unavailable if it is actually full (or overfull)
            targetTime.isAvailable =
              targetTime.currentBookings < targetTime.capacityPerSlot;
            await this.timeRepository.save(targetTime);

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
