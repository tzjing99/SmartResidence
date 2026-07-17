import { AccessRestrictionModule } from '@/access-restriction/access-restriction.module';
import { BillingModule } from '@/billing/billing.module';
import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { FacilityController } from './facility.controller';
import { FacilityService } from './facility.service';

@Module({
  imports: [BillingModule, AccessRestrictionModule],
  providers: [FacilityService, BookingService],
  controllers: [FacilityController, BookingController],
  exports: [FacilityService, BookingService],
})
export class FacilityModule {}
