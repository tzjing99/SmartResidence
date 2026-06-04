import { Module } from '@nestjs/common';
import { VisitorService } from './visitor.service';
import { VisitorController } from './visitor.controller';

@Module({
  providers: [VisitorService],
  controllers: [VisitorController],
  exports: [VisitorService],
})
export class VisitorModule {}
