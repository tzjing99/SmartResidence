import { Module } from '@nestjs/common';
import { DefectService } from './defect.service';
import { DefectController } from './defect.controller';

@Module({
  providers: [DefectService],
  controllers: [DefectController],
  exports: [DefectService],
})
export class DefectModule {}
