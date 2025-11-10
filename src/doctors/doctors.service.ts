import { Injectable } from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
<<<<<<< HEAD
import { InjectRepository } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DoctorsService {
  constructor(
    // 1. Inject the Doctor Repository
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
  ) {}

=======

@Injectable()
export class DoctorsService {
>>>>>>> feature4/auth-signout
  create(createDoctorDto: CreateDoctorDto) {
    return 'This action adds a new doctor';
  }

  findAll() {
<<<<<<< HEAD
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
=======
    return `This action returns all doctors`;
  }

  findOne(id: number) {
    return `This action returns a #${id} doctor`;
  }

  update(id: number, updateDoctorDto: UpdateDoctorDto) {
    return `This action updates a #${id} doctor`;
  }

  remove(id: number) {
>>>>>>> feature4/auth-signout
    return `This action removes a #${id} doctor`;
  }
}
