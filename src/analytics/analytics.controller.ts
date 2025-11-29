import {
  Controller,
  Get,
  UseGuards,
  Req,
  ConflictException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { DoctorsService } from 'src/doctors/doctors.service'; // To get Doctor ID from User ID

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly doctorsService: DoctorsService,
  ) {}

  @Get('my-utilization')
  async getMyUtilization(@Req() req: any) {
    if (req.user.role !== 'doctor') {
      throw new ConflictException('Only doctors can view analytics.');
    }

    const doctor = await this.doctorsService.findOneByUserId(req.user.userId);

    return this.analyticsService.getDoctorSlotUtilization(doctor.id);
  }
}
