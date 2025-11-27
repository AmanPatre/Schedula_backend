import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AuthGuard } from '@nestjs/passport';
import { RescheduleAllDto, RescheduleSelectedDto } from './dto/reschedule.dto';

@Controller('api/v1/appointments')
@UseGuards(AuthGuard('jwt'))
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto, @Req() req: any) {
    if (req.user.role !== 'patient') {
      throw new ForbiddenException('Only patients can book appointments.');
    }
    return this.appointmentsService.create(
      createAppointmentDto,
      req.user.userId,
    );
  }

  @Patch('reschedule-selected')
  async rescheduleSelected(
    @Body() dto: RescheduleSelectedDto,
    @Req() req: any,
  ) {
    if (req.user.role !== 'doctor') {
      throw new ForbiddenException('Only doctors can reschedule appointments.');
    }

    this.validateShift(dto.shift_minutes);

    return this.appointmentsService.rescheduleSelected(
      dto.appointment_ids,
      dto.shift_minutes,
      req.user.userId,
    );
  }

  @Patch('reschedule-all')
  async rescheduleAll(@Body() dto: RescheduleAllDto, @Req() req: any) {
    if (req.user.role !== 'doctor') {
      throw new ForbiddenException('Only doctors can reschedule appointments.');
    }

    this.validateShift(dto.shift_minutes);

    return this.appointmentsService.rescheduleAll(
      dto.shift_minutes,
      req.user.userId,
    );
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.appointmentsService.cancel(id, req.user);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.appointmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @Req() req: any,
  ) {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      throw new ForbiddenException('Unauthorized to update appointments.');
    }
    return this.appointmentsService.update(id, updateAppointmentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admins can delete records.');
    }
    return this.appointmentsService.remove(id);
  }

  private validateShift(minutes: number) {
    if (Math.abs(minutes) < 10) {
      throw new BadRequestException('Shift must be at least 10 minutes.');
    }
  }
}
