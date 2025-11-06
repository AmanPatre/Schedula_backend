import { Module } from '@nestjs/common';
import { TimesService } from './times.service';
import { TimesController } from './times.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Time } from './entities/time.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Time])],
  controllers: [TimesController],
  providers: [TimesService],
})
export class TimesModule {}
