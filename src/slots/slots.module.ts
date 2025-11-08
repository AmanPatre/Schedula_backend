import { Module } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from './entities/slot.entity';
import { Doctor } from 'src/doctors/entities/doctor.entity';
import { Time } from 'src/times/entities/time.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Slot, Doctor, Time])],
  controllers: [SlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
