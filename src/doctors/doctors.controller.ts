<<<<<<< HEAD
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
} from '@nestjs/common';
=======
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
>>>>>>> feature4/auth-signout
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

<<<<<<< HEAD
@UseInterceptors(ClassSerializerInterceptor)
=======
>>>>>>> feature4/auth-signout
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorsService.create(createDoctorDto);
  }

  @Get()
  findAll() {
    return this.doctorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
<<<<<<< HEAD
    return this.doctorsService.findOne(id);
=======
    return this.doctorsService.findOne(+id);
>>>>>>> feature4/auth-signout
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
<<<<<<< HEAD
    return this.doctorsService.update(id, updateDoctorDto);
=======
    return this.doctorsService.update(+id, updateDoctorDto);
>>>>>>> feature4/auth-signout
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
<<<<<<< HEAD
    return this.doctorsService.remove(id);
=======
    return this.doctorsService.remove(+id);
>>>>>>> feature4/auth-signout
  }
}
