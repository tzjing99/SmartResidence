import { Module } from '@nestjs/common';
import { ParcelScheduleService } from './parcel-schedule.service';
import { ParcelController } from './parcel.controller';
import { ParcelService } from './parcel.service';

@Module({
  providers: [ParcelService, ParcelScheduleService],
  controllers: [ParcelController],
  exports: [ParcelService],
})
export class ParcelModule {}
