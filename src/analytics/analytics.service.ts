import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot } from 'src/slots/entities/slot.entity'; //

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
  ) {}

  async getDoctorSlotUtilization(doctorId: string) {
    const slots = await this.slotRepo.find({
      where: { doctor: { id: doctorId } },
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
      totalSlots: slots.length,
      totalCapacity,
      totalBookings,
      utilizationRate: `${utilizationRate.toFixed(2)}%`,
    };
  }
}
