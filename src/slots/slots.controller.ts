import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  ConflictException,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';
import { SlotsService } from './slots.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createSlotDto: CreateSlotDto, @Req() req: any) {
    const user = req.user;

    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can set availability.');
    }

    return this.slotsService.create(createSlotDto, user.userId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id') id: string,
    @Body() updateSlotDto: UpdateSlotDto,
    @Req() req: any,
  ) {
    const user = req.user;
    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can update availability.');
    }
    return this.slotsService.update(id, updateSlotDto);
  }

  @Patch('time/:timeId')
  @UseGuards(AuthGuard('jwt'))
  updateTimeSlot(
    @Param('timeId') timeId: string,
    @Body() body: { capacityPerSlot: number },
    @Req() req: any,
  ) {
    const user = req.user;
    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can update availability.');
    }
    if (body.capacityPerSlot === undefined || body.capacityPerSlot < 0) {
      throw new ConflictException('Invalid capacity provided.');
    }

    return this.slotsService.updateTimeSlot(timeId, body.capacityPerSlot);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    if (user.role !== 'doctor') {
      throw new ConflictException('Only doctors can delete availability.');
    }
    return this.slotsService.remove(id);
  }
}
