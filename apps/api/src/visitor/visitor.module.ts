import { AccessRestrictionModule } from '@/access-restriction/access-restriction.module';
import { NotificationModule } from '@/notification/notification.module';
import { Module } from '@nestjs/common';
import { CondoVisitorSettingsController } from './condo-visitor-settings.controller';
import { RecurringPassController } from './recurring-pass.controller';
import { RecurringPassService } from './recurring-pass.service';
import { VisitorAutoCloseService } from './visitor-auto-close.service';
import { VisitorBlacklistController } from './visitor-blacklist.controller';
import { VisitorBlacklistService } from './visitor-blacklist.service';
import { VisitorController } from './visitor.controller';
import { VisitorService } from './visitor.service';

@Module({
  imports: [NotificationModule, AccessRestrictionModule],
  providers: [
    VisitorService,
    VisitorAutoCloseService,
    VisitorBlacklistService,
    RecurringPassService,
  ],
  controllers: [
    VisitorController,
    CondoVisitorSettingsController,
    VisitorBlacklistController,
    RecurringPassController,
  ],
  exports: [VisitorService, VisitorBlacklistService, RecurringPassService],
})
export class VisitorModule {}
