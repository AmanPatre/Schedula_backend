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
import { In, Repository } from 'typeorm';
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

    const sameDaySlots = await this.slotRepository.find({
      where: {
        doctor: { id: originalSlot.doctor.id },
        date: originalSlot.date,
        id: In([originalSlot.id]) === false ? undefined : undefined,
      },
      relations: ['times'],
    });

    const targetSlots = sameDaySlots.filter((s) => s.id !== originalSlot.id);

    for (const appointment of appointments) {
      let isResolved = false;

      for (const targetSlot of targetSlots) {
        if (
          targetSlot.scheduleType === 'stream' &&
          targetSlot.currentBookings < targetSlot.totalCapacity
        ) {
          const minutesToAdd =
            targetSlot.slotDuration * targetSlot.currentBookings;
          const [h, m] = targetSlot.consultingStartTime.split(':').map(Number);
          const newStart = new Date(originalSlot.date);
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

  async remove(id: string) {
    const slot = await this.slotRepository.findOne({
      where: { id },
      relations: ['times'],
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    let hasBookings = false;

    if (slot.scheduleType === 'stream') {
      if (slot.currentBookings > 0) {
        hasBookings = true;
      }
    } else if (slot.scheduleType === 'wave') {
      if (slot.times && slot.times.some((t) => t.currentBookings > 0)) {
        hasBookings = true;
      }
    }

    if (hasBookings) {
      throw new ConflictException(
        'Cannot delete this slot because it has active appointments. Please reschedule them first.',
      );
    }

    if (slot.times && slot.times.length > 0) {
      await this.timeRepository.remove(slot.times);
    }

    await this.slotRepository.remove(slot);
    return { message: 'Slot successfully deleted' };
  }

  findAll() {
    return `This action returns all slots`;
  }

  findOne(id: string) {
    return `This action returns a #${id} slot`;
  }
}
