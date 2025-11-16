import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ClassSerializerInterceptor,
  UseInterceptors,
  UseGuards,
  Req,
  ConflictException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AuthGuard } from '@nestjs/passport';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { Appointment } from './entities/appointment.entity';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get('patient/:patientId')
  findAllForPatient(@Param('patientId') patientId: string) {
    return this.appointmentsService.findAllForPatient(patientId);
  }

  @Get('doctor/my-schedule')
  @UseGuards(AuthGuard('jwt'))
  findAllForDoctor(@Req() req: any) {
    const user = req.user;
    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can view this schedule.');
    }
    return this.appointmentsService.findAllForDoctor(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Patch('reschedule/:id')
  @UseGuards(AuthGuard('jwt'))
  reschedule(
    @Param('id') id: string,
    @Body() rescheduleAppointmentDto: RescheduleAppointmentDto,
    @Req() req: any,
  ): Promise<Appointment> {
    return this.appointmentsService.reschedule(
      id,
      rescheduleAppointmentDto,
      req.user,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, updateAppointmentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }

  @Delete('doctor/cancel/:id')
  @UseGuards(AuthGuard('jwt'))
  doctorCancel(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can cancel appointments.');
    }
    return this.appointmentsService.doctorCancel(id, user.userId);
  }
}
