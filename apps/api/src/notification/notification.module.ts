import { BillingModule } from '@/billing/billing.module';
import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { MetaWhatsAppNotificationProvider } from './providers/whatsapp-notification.provider';
import { WHATSAPP_NOTIFICATION_PROVIDER } from './providers/whatsapp-notification.provider.interface';
import { WhatsAppConfigController } from './whatsapp-config.controller';
import { WhatsAppConfigService } from './whatsapp-config.service';

@Module({
  imports: [BillingModule],
  providers: [
    NotificationService,
    WhatsAppConfigService,
    MetaWhatsAppNotificationProvider,
    { provide: WHATSAPP_NOTIFICATION_PROVIDER, useExisting: MetaWhatsAppNotificationProvider },
  ],
  controllers: [NotificationController, WhatsAppConfigController],
  exports: [NotificationService, WhatsAppConfigService],
})
export class NotificationModule {}
