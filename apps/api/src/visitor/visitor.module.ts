import { NotificationModule } from '@/notification/notification.module';
import { Module } from '@nestjs/common';
import { CondoVisitorSettingsController } from './condo-visitor-settings.controller';
import { VisitorAutoCloseService } from './visitor-auto-close.service';
import { VisitorController } from './visitor.controller';
import { VisitorService } from './visitor.service';

@Module({
  imports: [NotificationModule],
  providers: [VisitorService, VisitorAutoCloseService],
  controllers: [VisitorController, CondoVisitorSettingsController],
  exports: [VisitorService],
})
export class VisitorModule {}
