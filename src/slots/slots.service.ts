import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSlotDto } from './dto/create-slot.dto';
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

    const newSlot = this.slotRepository.create({
      date: createSlotDto.date,
      doctor: doctor,
    });
    await this.slotRepository.save(newSlot);

    const timePromises = createSlotDto.startTimes.map((time) => {
      const newTime = this.timeRepository.create({
        startTime: time,
        isAvailable: true,
        slot: newSlot,
      });
      return this.timeRepository.save(newTime);
    });

    await Promise.all(timePromises);

    return newSlot;
  }

  findAll() {
    return `This action returns all slots`;
  }

  findOne(id: string) {
    return `This action returns a #${id} slot`;
  }
}
