import { Injectable, ConflictException } from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { Repository } from 'typeorm';
import { UserRole } from 'src/users/entities/user.entity';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
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
      userId: userId,
    });

    return this.doctorRepository.save(newDoctorProfile);
  }

  findAll() {
    return this.doctorRepository.find({
      relations: ['user'],
    });
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
