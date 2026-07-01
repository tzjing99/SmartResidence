import { EInvoiceModule } from '@/einvoice/einvoice.module';
import { NotificationModule } from '@/notification/notification.module';
import { Module, forwardRef } from '@nestjs/common';
import { QueueService } from './queue.service';

@Module({
  imports: [forwardRef(() => NotificationModule), forwardRef(() => EInvoiceModule)],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
