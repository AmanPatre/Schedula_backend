import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { Repository } from 'typeorm';
import { Slot } from 'src/slots/entities/slot.entity';
import { Time } from 'src/times/entities/time.entity';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Slot)
    private slotRepository: Repository<Slot>,
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
  ) {}

  async create(createDoctorDto: CreateDoctorDto, userId: string) {
    const existingProfile = await this.doctorRepository.findOne({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException(
        'Doctor profile already exists for this user',
      );
    }

    const newDoctorProfile = this.doctorRepository.create({
      ...createDoctorDto,
      userId,
    });

    return this.doctorRepository.save(newDoctorProfile);
  }

  findAll(specialization?: string) {
    const findOptions: any = {
      relations: ['user'],
      where: {},
    };

    if (specialization) {
      findOptions.where.specialization = specialization;
    }

    return this.doctorRepository.find(findOptions);
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
            slotId: slot.id,
            slot,
          });
        }
      }

      if (slot.scheduleType === 'wave') {
        const availableTimes = await this.timeRepository.find({
          where: {
            slot: { id: slot.id },
            isAvailable: true,
          },
          order: { startTime: 'ASC' },
        });

        if (availableTimes.length > 0) {
          response.push({
            scheduleType: 'wave',
            slotId: slot.id,
            date: slot.date,
            session: slot.session,
            availableTimes,
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

  findOne(id: string) {
    return `This action returns a #${id} doctor`;
  }

  update(id: string, updateDoctorDto: UpdateDoctorDto) {
    return `This action updates a #${id} doctor`;
  }

  remove(id: string) {
    return `This action removes a #${id} doctor`;
  }
}
