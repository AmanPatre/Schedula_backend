import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Analytics } from './entities/analytics.entity';
import { Slot } from 'src/slots/entities/slot.entity';
import { Doctor } from 'src/doctors/entities/doctor.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Analytics)
    private analyticsRepository: Repository<Analytics>,
    @InjectRepository(Slot)
    private slotRepository: Repository<Slot>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
  ) {}

  async getDoctorSlotUtilization(doctorUserId: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { userId: doctorUserId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const slots = await this.slotRepository.find({
      where: { doctor: { id: doctor.id } },
    });

    let totalCapacity = 0;
    let totalBookings = 0;

    slots.forEach((slot) => {
      totalCapacity += slot.totalCapacity || 0;
      totalBookings += slot.currentBookings || 0;
    });

    const utilizationRate =
      totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;

    return {
      totalSlotsDefined: slots.length,
      totalCapacity,
      currentBookings: totalBookings,
      utilizationPercentage: parseFloat(utilizationRate.toFixed(2)),
    };
  }
}
