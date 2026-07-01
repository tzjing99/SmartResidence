import { BillingModule } from '@/billing/billing.module';
import { Module } from '@nestjs/common';
import { CobPrefillService } from './cob-prefill';
import { CobController } from './cob.controller';
import { CobService } from './cob.service';

@Module({
  imports: [BillingModule],
  providers: [CobPrefillService, CobService],
  controllers: [CobController],
  exports: [CobService],
})
export class CobModule {}
