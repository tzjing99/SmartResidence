import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController, UnitController } from './tenant.controller';

@Module({
  providers: [TenantService],
  controllers: [TenantController, UnitController],
  exports: [TenantService],
})
export class TenantModule {}
