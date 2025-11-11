import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Slot } from './entities/slot.entity';
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

  async create(createSlotDto: CreateSlotDto, userId: string): Promise<Slot> {
    const doctor = await this.doctorRepository.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found for this user.');
    }

    // Create the slot with all properties from the DTO
    const newSlot = this.slotRepository.create({
      date: createSlotDto.date,
      doctor: doctor,
      session: createSlotDto.session,
      scheduleType: createSlotDto.scheduleType,
      dayOfWeek: createSlotDto.dayOfWeek,
      consultingStartTime: createSlotDto.consultingStartTime,
      slotDuration: createSlotDto.slotDuration,
      totalCapacity: createSlotDto.totalCapacity,
    });
    await this.slotRepository.save(newSlot);

    // If it's a WAVE, create all the Time blocks
    if (createSlotDto.scheduleType === 'wave' && createSlotDto.startTimes) {
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

    return newSlot;
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
