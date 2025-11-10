import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ClassSerializerInterceptor,
  UseInterceptors,
  UseGuards,
  Req,
  ConflictException,
  Patch, // Keep this import
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AuthGuard } from '@nestjs/passport';
// This DTO will be used for your next feature
// import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * Endpoint for: Patient to book an appointment
   */
  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  /**
   * Endpoint for: Patient to fetch their appointments
   */
  @Get('patient/:patientId')
  findAllForPatient(@Param('patientId') patientId: string) {
    return this.appointmentsService.findAllForPatient(patientId);
  }

  /**
   * Endpoint for: Patient to cancel their appointment
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }

  /**
   * Endpoint for: API for fetching doctor's appointments
   */
  @Get('doctor/my-schedule')
  @UseGuards(AuthGuard('jwt'))
  findAllForDoctor(@Req() req: any) {
    const user = req.user;

    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can view this schedule.');
    }
    return this.appointmentsService.findAllForDoctor(user.userId);
  }

  /**
   * Endpoint for: API for doctor to cancel appointment
   */
  @Delete('doctor/cancel/:id')
  @UseGuards(AuthGuard('jwt'))
  doctorCancel(@Param('id') id: string, @Req() req: any) {
    const user = req.user;

    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can cancel appointments.');
    }
    return this.appointmentsService.doctorCancel(id, user.userId);
  }

  /*
  // This is for your NEXT feature (Reschedule)
  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() rescheduleDto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(id, rescheduleDto);
  }
  */
}