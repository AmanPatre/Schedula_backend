import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Appointment } from './entities/appointment.entity';
import { Repository, In, MoreThan } from 'typeorm';
import { Time } from 'src/times/entities/time.entity';
import { Slot, ScheduleType } from 'src/slots/entities/slot.entity';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { RescheduleHistory } from './entities/reschedule-history.entity';
import { AppointmentStatus } from './entities/appointment-status.enum';
import { Patient } from 'src/patients/entities/patient.entity';
import { Doctor } from 'src/doctors/entities/doctor.entity';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
    @InjectRepository(Slot)
    private slotRepository: Repository<Slot>,
    @InjectRepository(RescheduleHistory)
    private rescheduleHistoryRepository: Repository<RescheduleHistory>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto, userId: string) {
    const { patientId, slotId, timeId, scheduleType } = createAppointmentDto;

    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (patient.userId !== userId) {
      throw new UnauthorizedException(
        'You can only book appointments for yourself.',
      );
    }

    let finalSlotId = slotId;
    let finalTimeId = timeId;

    if (scheduleType === ScheduleType.STREAM) {
      let slot = await this.slotRepository.findOne({
        where: { id: finalSlotId },
        relations: ['doctor'],
      });
      if (!slot) throw new NotFoundException('Slot not found');

      if (slot.currentBookings >= slot.totalCapacity) {
        const nextSlot = await this.slotRepository.findOne({
          where: {
            doctor: { id: slot.doctor.id },
            date: MoreThan(slot.date),
            scheduleType: ScheduleType.STREAM,
          },
          order: { date: 'ASC' },
        });

        if (!nextSlot || nextSlot.currentBookings >= nextSlot.totalCapacity) {
          throw new BadRequestException(
            'Selected slot is full and no future availability found.',
          );
        }

        slot = nextSlot;
        finalSlotId = nextSlot.id;
      }

      const appointment = this.appointmentRepository.create({
        patient,
        scheduleType,
        status: AppointmentStatus.BOOKED,
        slot: slot,
        doctor: slot.doctor,
      });

      const minutesToAdd = slot.slotDuration * slot.currentBookings;
      const [h, m] = slot.consultingStartTime.split(':').map(Number);
      const startTimeDate = new Date(slot.date);
      startTimeDate.setHours(h, m + minutesToAdd);
      const timeString = startTimeDate.toTimeString().split(' ')[0];

      const newTime = this.timeRepository.create({
        startTime: timeString,
        isAvailable: false,
        capacityPerSlot: 1,
        currentBookings: 1,
        slot: slot,
      });
      await this.timeRepository.save(newTime);

      appointment.time = newTime;

      slot.currentBookings++;
      await this.slotRepository.save(slot);

      return this.appointmentRepository.save(appointment);
    } else if (scheduleType === ScheduleType.WAVE) {
      let time = await this.timeRepository.findOne({
        where: { id: finalTimeId },
        relations: ['slot', 'slot.doctor'],
      });
      if (!time) throw new NotFoundException('Time slot not found');

      if (!time.isAvailable || time.currentBookings >= time.capacityPerSlot) {
        let nextTime = await this.timeRepository.findOne({
          where: {
            slot: { id: time.slot.id },
            isAvailable: true,
            startTime: MoreThan(time.startTime),
          },
          order: { startTime: 'ASC' },
        });

        if (!nextTime) {
          const nextSlot = await this.slotRepository.findOne({
            where: {
              doctor: { id: time.slot.doctor.id },
              date: MoreThan(time.slot.date),
              scheduleType: ScheduleType.WAVE,
            },
            order: { date: 'ASC' },
          });

          if (nextSlot) {
            nextTime = await this.timeRepository.findOne({
              where: { slot: { id: nextSlot.id }, isAvailable: true },
              order: { startTime: 'ASC' },
            });
          }
        }

        if (!nextTime) {
          throw new BadRequestException(
            'Selected time is full and no future availability found.',
          );
        }

        time = await this.timeRepository.findOne({
          where: { id: nextTime.id },
          relations: ['slot', 'slot.doctor'],
        });
      }

      const appointment = this.appointmentRepository.create({
        patient,
        scheduleType,
        status: AppointmentStatus.BOOKED,
        time: time,
        slot: time.slot,
        doctor: time.slot.doctor,
      });

      time.currentBookings++;
      if (time.currentBookings >= time.capacityPerSlot) {
        time.isAvailable = false;
      }
      await this.timeRepository.save(time);

      time.slot.currentBookings++;
      await this.slotRepository.save(time.slot);

      return this.appointmentRepository.save(appointment);
    }
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

  async cancel(id: string, user: any) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['time', 'time.slot', 'patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (
      appointment.patient.userId !== user.userId &&
      appointment.doctor.userId !== user.userId
    ) {
      throw new UnauthorizedException(
        'You are not authorized to cancel this appointment.',
      );
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    appointment.status = AppointmentStatus.CANCELLED;

    if (appointment.time) {
      appointment.time.currentBookings--;
      if (appointment.time.currentBookings < 0)
        appointment.time.currentBookings = 0;

      if (appointment.time.currentBookings < appointment.time.capacityPerSlot) {
        appointment.time.isAvailable = true;
      }
      await this.timeRepository.save(appointment.time);

      if (appointment.time.slot) {
        appointment.time.slot.currentBookings--;
        if (appointment.time.slot.currentBookings < 0)
          appointment.time.slot.currentBookings = 0;
        await this.slotRepository.save(appointment.time.slot);
      }
    }

    return this.appointmentRepository.save(appointment);
  }

  async rescheduleSelected(
    appointmentIds: string[],
    shiftMinutes: number,
    doctorUserId: string,
  ) {
    const doctor = await this.doctorRepository.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const appointments = await this.appointmentRepository.find({
      where: { id: In(appointmentIds) },
      relations: ['time', 'time.slot', 'doctor'],
    });

    if (appointments.length === 0) {
      throw new NotFoundException('No appointments found');
    }

    let rescheduledCount = 0;

    for (const appt of appointments) {
      if (appt.doctor.id !== doctor.id) {
        continue;
      }

      if (
        appt.status === AppointmentStatus.CANCELLED ||
        !this.isFuture(appt.time)
      ) {
        continue;
      }

      await this.applyShiftToAppointment(appt, shiftMinutes);
      rescheduledCount++;
    }

    return {
      message: `Successfully rescheduled ${rescheduledCount} appointments.`,
    };
  }

  async rescheduleAll(
    shiftMinutes: number,
    doctorUserId: string,
    slotId?: string,
  ) {
    const doctor = await this.doctorRepository.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    // Build the query dynamically
    const where: any = {
      doctor: { id: doctor.id },
      status: AppointmentStatus.BOOKED,
    };

    // If slotId is provided, only fetch appointments linked to that slot
    if (slotId) {
      where.slot = { id: slotId };
    }

    const allAppointments = await this.appointmentRepository.find({
      where: where,
      relations: ['time', 'time.slot'],
    });

    let rescheduledCount = 0;

    for (const appt of allAppointments) {
      if (this.isFuture(appt.time)) {
        await this.applyShiftToAppointment(appt, shiftMinutes);
        rescheduledCount++;
      }
    }

    return {
      message: `Successfully rescheduled ${rescheduledCount} future appointments.`,
    };
  }

  async reschedule(
    appointmentId: string,
    rescheduleDto: RescheduleAppointmentDto,
    user: any,
  ): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: ['time', 'time.slot', 'patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patient.userId !== user.userId) {
      throw new UnauthorizedException(
        'You are not authorized to reschedule this appointment.',
      );
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot reschedule a cancelled appointment.',
      );
    }

    const previousTime = appointment.time;
    const previousScheduleType = appointment.scheduleType;

    if (previousTime) {
      if (previousScheduleType === 'wave') {
        previousTime.currentBookings -= 1;
        if (previousTime.currentBookings < 0) previousTime.currentBookings = 0;
        previousTime.isAvailable = true;
        await this.timeRepository.save(previousTime);
        if (previousTime.slot) {
          previousTime.slot.currentBookings -= 1;
          if (previousTime.slot.currentBookings < 0)
            previousTime.slot.currentBookings = 0;
          await this.slotRepository.save(previousTime.slot);
        }
      } else if (previousScheduleType === 'stream') {
        const slot = previousTime.slot;
        if (slot) {
          slot.currentBookings -= 1;
          if (slot.currentBookings < 0) slot.currentBookings = 0;
          await this.slotRepository.save(slot);
        }
      }
    }

    const { timeId, slotId } = rescheduleDto;
    let newAppointmentTime: Time;
    let newScheduleType: ScheduleType;
    let newDoctor: Doctor;

    if (timeId) {
      const timeSlot = await this.timeRepository.findOne({
        where: { id: timeId },
        relations: ['slot', 'slot.doctor'],
      });
      if (!timeSlot) throw new NotFoundException('New time slot not found');
      if (
        !timeSlot.isAvailable ||
        timeSlot.currentBookings >= timeSlot.capacityPerSlot
      ) {
        throw new ConflictException('This time slot is not available.');
      }
      timeSlot.currentBookings += 1;
      if (timeSlot.currentBookings >= timeSlot.capacityPerSlot)
        timeSlot.isAvailable = false;
      newAppointmentTime = await this.timeRepository.save(timeSlot);
      timeSlot.slot.currentBookings += 1;
      await this.slotRepository.save(timeSlot.slot);
      newScheduleType = ScheduleType.WAVE;
      newDoctor = timeSlot.slot.doctor;
    } else if (slotId) {
      const streamSlot = await this.slotRepository.findOne({
        where: { id: slotId },
        relations: ['doctor'],
      });
      if (!streamSlot) throw new NotFoundException('New stream slot not found');
      if (streamSlot.currentBookings >= streamSlot.totalCapacity) {
        throw new ConflictException('This stream slot is fully booked.');
      }
      const minutesToAdd = streamSlot.slotDuration * streamSlot.currentBookings;
      const [h, m] = streamSlot.consultingStartTime.split(':').map(Number);
      const startTimeDate = new Date(streamSlot.date);
      startTimeDate.setHours(h, m + minutesToAdd);
      const timeString = startTimeDate.toTimeString().split(' ')[0];

      const newTime = this.timeRepository.create({
        startTime: timeString,
        isAvailable: false,
        capacityPerSlot: 1,
        currentBookings: 1,
        slot: streamSlot,
      });
      newAppointmentTime = await this.timeRepository.save(newTime);
      streamSlot.currentBookings += 1;
      await this.slotRepository.save(streamSlot);
      newScheduleType = ScheduleType.STREAM;
      newDoctor = streamSlot.doctor;
    } else {
      throw new ConflictException('Either timeId or slotId must be provided.');
    }

    const historyEntry = this.rescheduleHistoryRepository.create({
      appointment: appointment,
      previousTime: previousTime,
      newTime: newAppointmentTime,
      reason: rescheduleDto.reason,
    });
    await this.rescheduleHistoryRepository.save(historyEntry);

    appointment.time = newAppointmentTime;
    appointment.scheduleType = newScheduleType;
    appointment.doctor = newDoctor;
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    if (previousScheduleType === 'stream' && previousTime) {
      await this.timeRepository.remove(previousTime);
    }

    return updatedAppointment;
  }

  private async applyShiftToAppointment(
    appt: Appointment,
    shiftMinutes: number,
  ) {
    const oldTimeEntity = appt.time;

    const newStartTime = this.addMinutesToTime(
      oldTimeEntity.startTime,
      shiftMinutes,
    );

    if (appt.scheduleType === ScheduleType.STREAM) {
      oldTimeEntity.startTime = newStartTime;
      const savedNewTime = await this.timeRepository.save(oldTimeEntity);

      const history = this.rescheduleHistoryRepository.create({
        appointment: appt,
        previousTime: undefined,
        newTime: savedNewTime,
        reason: `Doctor rescheduled by ${shiftMinutes} minutes`,
      });
      await this.rescheduleHistoryRepository.save(history);
    } else if (appt.scheduleType === ScheduleType.WAVE) {
      oldTimeEntity.currentBookings--;
      if (oldTimeEntity.currentBookings < 0) oldTimeEntity.currentBookings = 0;
      oldTimeEntity.isAvailable = true;
      await this.timeRepository.save(oldTimeEntity);

      const newTimeEntity = this.timeRepository.create({
        startTime: newStartTime,
        isAvailable: false,
        capacityPerSlot: 1,
        currentBookings: 1,
        slot: oldTimeEntity.slot,
      });
      const savedNewTime = await this.timeRepository.save(newTimeEntity);

      appt.time = savedNewTime;
      await this.appointmentRepository.save(appt);

      const history = this.rescheduleHistoryRepository.create({
        appointment: appt,
        previousTime: undefined,
        newTime: savedNewTime,
        reason: `Doctor rescheduled by ${shiftMinutes} minutes`,
      });
      await this.rescheduleHistoryRepository.save(history);
    }
  }

  private addMinutesToTime(timeString: string, minutesToAdd: number): string {
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, seconds || 0);
    date.setMinutes(date.getMinutes() + minutesToAdd);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private isFuture(timeSlot: Time): boolean {
    if (!timeSlot || !timeSlot.slot) return false;
    const now = new Date();
    const slotDate = new Date(timeSlot.slot.date);
    const [h, m] = timeSlot.startTime.split(':').map(Number);
    const appointmentDateTime = new Date(slotDate);
    appointmentDateTime.setHours(h, m, 0);
    return appointmentDateTime > now;
  }

  findAll() {
    return `This action returns all appointments`;
  }

  remove(id: string) {
    return `This action removes a #${id} appointment`;
  }
  update(id: string, updateAppointmentDto: UpdateAppointmentDto) {
    return this.appointmentRepository.update(id, updateAppointmentDto);
  }
}
