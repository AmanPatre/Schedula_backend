import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  ConflictException,
} from '@nestjs/common';
import { SlotsService } from './slots.service';
import { CreateSlotDto } from './dto/create-slot.dto';
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
}
