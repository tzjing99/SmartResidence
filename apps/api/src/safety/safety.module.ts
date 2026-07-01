import { Module } from '@nestjs/common';
import { PatrolScheduleService } from './patrol-schedule.service';
import { PatrolController } from './patrol.controller';
import { PatrolService } from './patrol.service';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';

@Module({
  providers: [SosService, PatrolService, PatrolScheduleService],
  controllers: [SosController, PatrolController],
  exports: [SosService, PatrolService],
})
export class SafetyModule {}
