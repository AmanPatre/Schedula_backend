import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Analytics } from './entities/analytics.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Slot } from 'src/slots/entities/slot.entity';
import { DoctorsModule } from 'src/doctors/doctors.module';

@Module({
  imports: [TypeOrmModule.forFeature([Analytics, Slot]), DoctorsModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
