import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Time } from './entities/time.entity';

@Injectable()
export class TimesService {
  constructor(
    @InjectRepository(Time)
    private timeRepository: Repository<Time>,
  ) {}

  async remove(id: string) {
    const time = await this.timeRepository.findOne({ where: { id } });

    if (!time) {
      throw new NotFoundException('Time slot not found');
    }

    if (time.currentBookings > 0) {
      throw new ConflictException(
        'Cannot delete this time because it has active appointments. Please reschedule them first.',
      );
    }

    await this.timeRepository.remove(time);
    return { message: 'Time slot successfully deleted' };
  }

  create(dto: any) {
    return 'not implemented';
  }
  findAll() {
    return 'not implemented';
  }
  findOne(id: number) {
    return 'not implemented';
  }
  update(id: number, dto: any) {
    return 'not implemented';
  }
}
