import { AccountingModule } from '@/accounting/accounting.module';
import { Module } from '@nestjs/common';
import { VendorBillExportsService } from './vendor-bill-exports.service';
import { VendorBillController } from './vendor-bill.controller';
import { VendorBillService } from './vendor-bill.service';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

@Module({
  imports: [AccountingModule],
  controllers: [VendorController, VendorBillController],
  providers: [VendorService, VendorBillService, VendorBillExportsService],
  exports: [VendorService, VendorBillService],
})
export class ProcurementModule {}
