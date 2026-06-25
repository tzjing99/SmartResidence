import { Module } from '@nestjs/common';
import { HandoverConfigController } from './handover-config.controller';
import { HandoverConfigService } from './handover-config.service';

@Module({
  controllers: [HandoverConfigController],
  providers: [HandoverConfigService],
  exports: [HandoverConfigService],
})
export class HandoverModule {}
