import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  NotImplementedException,
} from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Repository } from 'typeorm';
import { Time } from 'src/times/entities/time.entity';
import { ConfigService } from '@nestjs/config';
import { Slot } from 'src/slots/entities/slot.entity';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { RescheduleHistory } from './entities/reschedule-history.entity';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
    @InjectRepository(Slot)
    private slotRepository: Repository<Slot>,
    private configService: ConfigService,

    @InjectRepository(RescheduleHistory)
    private rescheduleHistoryRepository: Repository<RescheduleHistory>,
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const { patientId, timeId, slotId } = createAppointmentDto;

    if (timeId) {
      const timeSlot = await this.timeRepository.findOne({
        where: { id: timeId },
        relations: ['slot', 'slot.doctor'],
      });

      if (!timeSlot) {
        throw new NotFoundException('Time slot not found');
      }
      if (!timeSlot.isAvailable) {
        throw new NotFoundException('Time slot is no longer available');
      }
      if (timeSlot.currentBookings >= timeSlot.capacityPerSlot) {
        throw new ConflictException('This time slot is already full.');
      }

      timeSlot.currentBookings += 1;
      if (timeSlot.currentBookings >= timeSlot.capacityPerSlot) {
        timeSlot.isAvailable = false;
      }
      await this.timeRepository.save(timeSlot);

      const newAppointment = this.appointmentRepository.create({
        patient: { id: patientId },
        time: timeSlot,
        doctor: timeSlot.slot.doctor,
        scheduleType: timeSlot.slot.scheduleType,
      });

      return this.appointmentRepository.save(newAppointment);
    }

    if (slotId) {
      const streamSlot = await this.slotRepository.findOne({
        where: { id: slotId },
        relations: ['doctor'],
      });

      if (!streamSlot) {
        throw new NotFoundException('Stream slot not found');
      }
      if (streamSlot.currentBookings >= streamSlot.totalCapacity) {
        throw new ConflictException('This stream slot is fully booked.');
      }

      const minutesToAdd = streamSlot.slotDuration * streamSlot.currentBookings;
      const [hours, minutes] = streamSlot.consultingStartTime
        .split(':')
        .map(Number);
      const newStartTime = new Date(0);
      newStartTime.setHours(hours, minutes + minutesToAdd, 0, 0);

      const newTime = this.timeRepository.create({
        startTime: newStartTime.toTimeString().split(' ')[0],
        isAvailable: false,
        capacityPerSlot: 1,
        currentBookings: 1,
        slot: streamSlot,
      });
      await this.timeRepository.save(newTime);

      streamSlot.currentBookings += 1;
      await this.slotRepository.save(streamSlot);

      const newAppointment = this.appointmentRepository.create({
        patient: { id: patientId },
        time: newTime,
        doctor: streamSlot.doctor,
        scheduleType: streamSlot.scheduleType,
      });

      return this.appointmentRepository.save(newAppointment);
    }

    throw new ConflictException(
      'Either timeId (for Wave) or slotId (for Stream) must be provided.',
    );
  }

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: id },
      relations: [
        'doctor',
        'doctor.user',
        'patient',
        'patient.user',
        'time',
        'time.slot',
      ],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID "${id}" not found`);
    }

    return appointment;
  }

  findAllForPatient(patientId: string): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: { patient: { id: patientId } },
      relations: ['doctor', 'doctor.user', 'time', 'time.slot'],
    });
  }

  async findAllForDoctor(userId: string): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: { doctor: { userId: userId } },
      relations: ['patient', 'patient.user', 'time', 'time.slot'],
    });
  }

  async reschedule(
    appointmentId: string,
    rescheduleDto: RescheduleAppointmentDto,
    user: any,
  ): Promise<any> {
    throw new NotImplementedException('Reschedule feature is coming soon.');
  }

  async remove(id: string): Promise<{ message: string }> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['time', 'time.slot'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.scheduleType === 'wave') {
      const timeSlot = appointment.time;
      if (timeSlot) {
        timeSlot.currentBookings -= 1;
        timeSlot.isAvailable = true;
        await this.timeRepository.save(timeSlot);
      }
    }

    if (appointment.scheduleType === 'stream') {
      const slot = appointment.time.slot;
      if (slot) {
        slot.currentBookings -= 1;
        await this.slotRepository.save(slot);
      }
      if (appointment.time) {
        await this.timeRepository.remove(appointment.time);
      }
    }

    await this.appointmentRepository.remove(appointment);
    return { message: 'Appointment successfully canceled' };
  }

  async doctorCancel(
    appointmentId: string,
    doctorUserId: string,
  ): Promise<{ message: string }> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: ['time', 'time.slot', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.doctor.userId !== doctorUserId) {
      throw new UnauthorizedException(
        'You are not authorized to cancel this appointment.',
      );
    }

    return this.remove(appointmentId);
  }

  findAll() {
    return `This action returns all appointments`;
  }

  update(id: string, updateAppointmentDto: UpdateAppointmentDto) {
    return `This action updates a #${id} appointment`;
  }
}
