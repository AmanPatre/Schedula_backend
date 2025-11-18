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
import { Repository } from 'typeorm';
import { Doctor } from 'src/doctors/entities/doctor.entity';
import { Time } from 'src/times/entities/time.entity';

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(Slot)
    private slotRepository: Repository<Slot>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
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

  findAll() {
    return `This action returns all slots`;
  }

  findOne(id: string) {
    return `This action returns a #${id} slot`;
  }

  update(id: string, updateSlotDto: UpdateSlotDto) {
    return `This action updates a #${id} slot`;
  }

  remove(id: string) {
    return `This action removes a #${id} slot`;
  }
}
