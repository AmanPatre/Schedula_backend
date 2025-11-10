import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Repository } from 'typeorm';
import { Time } from 'src/times/entities/time.entity';
import { Slot, ScheduleType } from 'src/slots/entities/slot.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import dayjs from 'dayjs';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
    @InjectRepository(Slot)
    private slotRepository: Repository<Slot>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const { patientId, timeId, slotId } = createAppointmentDto;

    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    let timeSlotToBook: Time;
    let newAppointment: Appointment;

    if (timeId) {
      const foundTime = await this.timeRepository.findOne({
        where: { id: timeId },
        relations: ['slot', 'slot.doctor'],
      });

      if (!foundTime) {
        throw new NotFoundException('Time slot not found');
      }
      timeSlotToBook = foundTime;

      if (timeSlotToBook.slot.scheduleType !== ScheduleType.WAVE) {
        throw new ConflictException(
          'This endpoint is for WAVE scheduling. Please provide a timeId.',
        );
      }
      if (!timeSlotToBook.isAvailable) {
        throw new ConflictException('This time slot is no longer available.');
      }
      if (timeSlotToBook.currentBookings >= timeSlotToBook.capacity) {
        throw new ConflictException('This time slot is full.');
      }

      timeSlotToBook.currentBookings++;
      if (timeSlotToBook.currentBookings === timeSlotToBook.capacity) {
        timeSlotToBook.isAvailable = false;
      }
      await this.timeRepository.save(timeSlotToBook);

      newAppointment = this.appointmentRepository.create({
        patient: patient,
        time: timeSlotToBook,
        doctor: timeSlotToBook.slot.doctor,
      });
    } else if (slotId) {
      const streamSlot = await this.slotRepository.findOne({
        where: { id: slotId },
        relations: ['doctor'],
      });

      if (!streamSlot) {
        throw new NotFoundException('Stream slot not found');
      }
      if (streamSlot.scheduleType !== ScheduleType.STREAM) {
        throw new ConflictException(
          'This endpoint is for STREAM scheduling. Please provide a slotId.',
        );
      }
      if (streamSlot.currentBookings >= streamSlot.capacity) {
        throw new ConflictException('This streaming slot is full.');
      }

      const [hours, minutes, seconds] = streamSlot.consultingStartTime
        .split(':')
        .map(Number);

      const startTime = dayjs(streamSlot.date)
        .hour(hours)
        .minute(minutes)
        .second(seconds);

      const bookingTime = startTime.add(
        streamSlot.currentBookings * streamSlot.slotDuration,
        'minute',
      );

      const newTimeSlot = this.timeRepository.create({
        startTime: bookingTime.format('HH:mm:ss'),
        isAvailable: false,
        capacity: 1,
        currentBookings: 1,
        slot: streamSlot,
      });
      timeSlotToBook = await this.timeRepository.save(newTimeSlot);

      streamSlot.currentBookings++;
      await this.slotRepository.save(streamSlot);

      newAppointment = this.appointmentRepository.create({
        patient: patient,
        time: timeSlotToBook,
        doctor: streamSlot.doctor,
      });
    } else {
      throw new ConflictException(
        'Either timeId (for Wave) or slotId (for Stream) must be provided.',
      );
    }

    return this.appointmentRepository.save(newAppointment);
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

  async remove(id: string): Promise<{ message: string }> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['time', 'time.slot'], // Need time.slot here
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.time) {
      if (appointment.time.slot.scheduleType === ScheduleType.WAVE) {
        appointment.time.currentBookings--;
        appointment.time.isAvailable = true;
        await this.timeRepository.save(appointment.time);
      } else if (appointment.time.slot.scheduleType === ScheduleType.STREAM) {
        const slot = await this.slotRepository.findOne({
          where: { id: appointment.time.slot.id },
        });
        if (slot) {
          slot.currentBookings--;
          await this.slotRepository.save(slot);
        }
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

    if (appointment.time) {
      if (appointment.time.slot.scheduleType === ScheduleType.WAVE) {
        appointment.time.currentBookings--;
        appointment.time.isAvailable = true;
        await this.timeRepository.save(appointment.time);
      } else if (appointment.time.slot.scheduleType === ScheduleType.STREAM) {
        const slot = await this.slotRepository.findOne({
          where: { id: appointment.time.slot.id },
        });
        if (slot) {
          slot.currentBookings--;
          await this.slotRepository.save(slot);
        }
        await this.timeRepository.remove(appointment.time);
      }
    }

    await this.appointmentRepository.remove(appointment);

    return { message: 'Appointment successfully canceled by doctor.' };
  }

  findAll() {
    return `This action returns all appointments`;
  }

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
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
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }
}
