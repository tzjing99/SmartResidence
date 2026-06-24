import { Module } from '@nestjs/common';
import { AnnouncementScheduleService } from './announcement-schedule.service';
import { AnnouncementController } from './announcement.controller';
import { AnnouncementService } from './announcement.service';

@Module({
  providers: [AnnouncementService, AnnouncementScheduleService],
  controllers: [AnnouncementController],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
