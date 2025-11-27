import {
  Controller,
  Delete,
  Param,
  UseGuards,
  Req,
  ConflictException,
} from '@nestjs/common';
import { TimesService } from './times.service';
import { AuthGuard } from '@nestjs/passport';

import { SlotsService } from 'src/slots/slots.service';

@Controller('times')
export class TimesController {
  constructor(
    private readonly timesService: TimesService,

    private readonly slotsService: SlotsService,
  ) {}

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can delete availability.');
    }

    return this.slotsService.deleteTimeSlot(id);
  }
}
