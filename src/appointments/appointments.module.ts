import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
<<<<<<< HEAD
import { Time } from 'src/times/entities/time.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, Time])],
=======

@Module({
  imports: [TypeOrmModule.forFeature([Appointment])],
>>>>>>> feature4/auth-signout
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
