import { BillingModule } from '@/billing/billing.module';
import { Module } from '@nestjs/common';
import { CobController } from './cob.controller';
import { CobPrefillService } from './cob-prefill';
import { CobService } from './cob.service';

@Module({
  imports: [BillingModule],
  providers: [CobPrefillService, CobService],
  controllers: [CobController],
  exports: [CobService],
})
export class CobModule {}
