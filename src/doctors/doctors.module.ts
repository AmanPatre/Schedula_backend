import { Module } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { Slot } from 'src/slots/entities/slot.entity';
import { Time } from 'src/times/entities/time.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor, Slot, Time])],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
