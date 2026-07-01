import { NotificationModule } from '@/notification/notification.module';
import { Module } from '@nestjs/common';
import { TenantController, UnitController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [NotificationModule],
  providers: [TenantService],
  controllers: [TenantController, UnitController],
  exports: [TenantService],
})
export class TenantModule {}
