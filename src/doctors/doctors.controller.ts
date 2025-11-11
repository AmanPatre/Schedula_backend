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
  Query,
} from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { AuthGuard } from '@nestjs/passport';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createDoctorDto: CreateDoctorDto, @Req() req: any) {
    const user = req.user;

    if (user.role !== 'doctor') {
      throw new ConflictException(
        'Only users with role "doctor" can create a doctor profile.',
      );
    }

    return this.doctorsService.create(createDoctorDto, user.userId);
  }

  @Get()
  findAll(@Query('specialization') specialization: string) {
    return this.doctorsService.findAll(specialization);
  }

  @Get(':id/available-slots')
  getDoctorAvailability(
    @Param('id') doctorId: string,
    @Query('date') date: string,
  ) {
    return this.doctorsService.findAvailableSlotsForDoctor(doctorId, date);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
    return this.doctorsService.update(id, updateDoctorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.doctorsService.remove(id);
  }
}
