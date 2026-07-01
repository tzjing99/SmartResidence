import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { BankReconciliationService } from './bank-reconciliation.service';
import { CoaService } from './coa.service';
import { GlPostingService } from './gl-posting.service';
import { GlService } from './gl.service';

@Module({
  controllers: [AccountingController],
  providers: [CoaService, GlService, GlPostingService, BankReconciliationService],
  exports: [CoaService, GlService, GlPostingService, BankReconciliationService],
})
export class AccountingModule {}
