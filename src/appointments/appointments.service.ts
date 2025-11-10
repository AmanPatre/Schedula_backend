<<<<<<< HEAD
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Repository } from 'typeorm';
import { Time } from 'src/times/entities/time.entity';
import { Patient } from 'src/patients/entities/patient.entity';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const timeSlot = await this.timeRepository.findOne({
      where: { id: createAppointmentDto.time.id },
      relations: ['slot', 'slot.doctor'],
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }
    if (!timeSlot.isAvailable) {
      throw new NotFoundException('Time slot is no longer available');
    }

    timeSlot.isAvailable = false;
    await this.timeRepository.save(timeSlot);

    const newAppointment = this.appointmentRepository.create({
      patient: createAppointmentDto.patient,
      time: timeSlot,
      doctor: timeSlot.slot.doctor,
    });

    return this.appointmentRepository.save(newAppointment);
  }

  findAllForPatient(patientId: string): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: { patient: { id: patientId } },

      relations: ['doctor', 'doctor.user', 'time', 'time.slot'],
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['time'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.time) {
      appointment.time.isAvailable = true;
      await this.timeRepository.save(appointment.time);
    }

    await this.appointmentRepository.remove(appointment);

    return { message: 'Appointment successfully canceled' };
=======
import { Injectable } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  create(createAppointmentDto: CreateAppointmentDto) {
    return 'This action adds a new appointment';
>>>>>>> feature4/auth-signout
  }

  findAll() {
    return `This action returns all appointments`;
  }

<<<<<<< HEAD
  findOne(id: string) {
    return `This action returns a #${id} appointment`;
  }
=======
  findOne(id: number) {
    return `This action returns a #${id} appointment`;
  }

  update(id: number, updateAppointmentDto: UpdateAppointmentDto) {
    return `This action updates a #${id} appointment`;
  }

  remove(id: number) {
    return `This action removes a #${id} appointment`;
  }
>>>>>>> feature4/auth-signout
}
