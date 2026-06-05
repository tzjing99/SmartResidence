import { Module } from '@nestjs/common';
import { DefectController } from './defect.controller';
import { DefectService } from './defect.service';

@Module({
  providers: [DefectService],
  controllers: [DefectController],
  exports: [DefectService],
})
export class DefectModule {}
