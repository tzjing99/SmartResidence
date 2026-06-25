import { Module } from '@nestjs/common';
import { DefectReportController } from './defect-report.controller';
import { DefectReportService } from './defect-report.service';
import { DefectController } from './defect.controller';
import { DefectService } from './defect.service';

@Module({
  providers: [DefectService, DefectReportService],
  controllers: [DefectController, DefectReportController],
  exports: [DefectService, DefectReportService],
})
export class DefectModule {}
