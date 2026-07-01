import { Module } from '@nestjs/common';
import { PollScheduleService } from './poll-schedule.service';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';

@Module({
  providers: [PollsService, PollScheduleService],
  controllers: [PollsController],
  exports: [PollsService],
})
export class PollsModule {}
