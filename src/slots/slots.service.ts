import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateSlotDto } from './dto/create-slot.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Slot, ScheduleType, DayOfWeek } from './entities/slot.entity';
import { Repository, Raw } from 'typeorm';
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

  async create(createSlotDto: CreateSlotDto, userId: string): Promise<Slot> {
    const doctor = await this.doctorRepository.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found for this user.');
    }

    const dateObj = new Date(createSlotDto.date);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;

    const newSlot = this.slotRepository.create({
      date: createSlotDto.date,
      doctor: doctor,
      scheduleType: createSlotDto.scheduleType,
      session: createSlotDto.session,
      dayOfWeek: dayOfWeek,
    });

    let savedTimes: Time[] = [];

    if (createSlotDto.scheduleType === ScheduleType.WAVE) {
      if (
        !createSlotDto.startTimes ||
        !createSlotDto.capacityPerSlot ||
        createSlotDto.startTimes.length === 0
      ) {
        throw new ConflictException(
          'For WAVE scheduling, startTimes and capacityPerSlot are required.',
        );
      }

      newSlot.capacity =
        createSlotDto.startTimes.length * createSlotDto.capacityPerSlot;

      await this.slotRepository.save(newSlot);

      const timePromises = createSlotDto.startTimes.map((time) => {
        const newTime = this.timeRepository.create({
          startTime: time,
          isAvailable: true,
          slot: newSlot,
          capacity: createSlotDto.capacityPerSlot,
          currentBookings: 0,
        });
        return this.timeRepository.save(newTime);
      });
      savedTimes = await Promise.all(timePromises);
    } else if (createSlotDto.scheduleType === ScheduleType.STREAM) {
      if (
        !createSlotDto.consultingStartTime ||
        !createSlotDto.slotDuration ||
        !createSlotDto.totalCapacity
      ) {
        throw new ConflictException(
          'For STREAM scheduling, consultingStartTime, slotDuration, and totalCapacity are required.',
        );
      }
      newSlot.consultingStartTime = createSlotDto.consultingStartTime;
      newSlot.slotDuration = createSlotDto.slotDuration;
      newSlot.capacity = createSlotDto.totalCapacity;
      newSlot.currentBookings = 0;

      await this.slotRepository.save(newSlot);
    }

    newSlot.times = savedTimes;
    return newSlot;
  }

  async findAvailableSlotsForDoctor(
    doctorId: string,
    date: string,
  ): Promise<Slot[]> {
    const slots = await this.slotRepository.find({
      where: {
        doctor: { id: doctorId },

        date: Raw((alias) => `${alias} = :date`, { date: date }),
      },
      relations: ['times'],
    });

    if (!slots || slots.length === 0) {
      throw new NotFoundException(
        'No slots found for this doctor on this date.',
      );
    }

    const availableSlots = slots
      .map((slot) => {
        if (slot.scheduleType === ScheduleType.WAVE) {
          slot.times = slot.times.filter(
            (time) => time.isAvailable && time.currentBookings < time.capacity,
          );
        }
        return slot;
      })
      .filter((slot) => {
        if (slot.scheduleType === ScheduleType.WAVE) {
          return slot.times.length > 0;
        }
        if (slot.scheduleType === ScheduleType.STREAM) {
          return slot.currentBookings < slot.capacity;
        }
        return false;
      });

    if (availableSlots.length === 0) {
      throw new NotFoundException(
        'No available slots found for this doctor on this date.',
      );
    }

    return availableSlots;
  }

  findAll() {
    return `This action returns all slots`;
  }

  findOne(id: string) {
    return `This action returns a #${id} slot`;
  }
}
