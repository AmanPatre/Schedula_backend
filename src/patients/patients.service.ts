import { Injectable, ConflictException } from '@nestjs/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Patient } from './entities/patient.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async create(createPatientDto: CreatePatientDto, userId: string) {
    const existingProfile = await this.patientRepository.findOne({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException(
        'Patient profile already exists for this user',
      );
    }

    const newPatientProfile = this.patientRepository.create({
      ...createPatientDto,
      userId: userId,
    });

    return this.patientRepository.save(newPatientProfile);
  }

  findAll() {
    return `This action returns all patients`;
  }

  findOne(id: string) {
    return `This action returns a #${id} patient`;
  }

  update(id: string, updatePatientDto: UpdatePatientDto) {
    return `This action updates a #${id} patient`;
  }

  remove(id: string) {
    return `This action removes a #${id} patient`;
  }
}
