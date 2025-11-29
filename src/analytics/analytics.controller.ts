import {
  Controller,
  Get,
  UseGuards,
  Req,
  ConflictException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('utilization')
  getSlotUtilization(@Req() req: any) {
    if (req.user.role !== 'doctor') {
      throw new ConflictException(
        'Only doctors can view utilization analytics.',
      );
    }
    return this.analyticsService.getDoctorSlotUtilization(req.user.userId);
  }
}
