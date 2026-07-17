import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

import { AccessRestrictionModule } from './access-restriction/access-restriction.module';
import { AccountingModule } from './accounting/accounting.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CacheModule } from './cache/cache.module';
import { CobModule } from './cob/cob.module';
import { DefectModule } from './defect/defect.module';
import { DocumentsModule } from './documents/documents.module';
import { EInvoiceModule } from './einvoice/einvoice.module';
import { FacilityModule } from './facility/facility.module';
import { FaqModule } from './faq/faq.module';
import { FormsModule } from './forms/forms.module';
import { GovernanceModule } from './governance/governance.module';
import { HandoverModule } from './handover/handover.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LostFoundModule } from './lost-found/lost-found.module';
import { NotificationModule } from './notification/notification.module';
import { OwnerModule } from './owner/owner.module';
import { ParcelModule } from './parcel/parcel.module';
import { PlatformModule } from './platform/platform.module';
import { PollsModule } from './polls/polls.module';
import { ProcurementModule } from './procurement/procurement.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SafetyModule } from './safety/safety.module';
import { SetupModule } from './setup/setup.module';
import { SlaModule } from './sla/sla.module';
import { StorageModule } from './storage/storage.module';
import { TenantModule } from './tenant/tenant.module';
import { ThreadsModule } from './threads/threads.module';
import { UsersModule } from './users/users.module';
import { VisitorModule } from './visitor/visitor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 120 },
    ]),
    PrismaModule,
    RedisModule,
    CacheModule,
    QueueModule,
    HealthModule,
    StorageModule,
    AuthModule,
    UsersModule,
    TenantModule,
    VisitorModule,
    AccessRestrictionModule,
    BillingModule,
    EInvoiceModule,
    DefectModule,
    AnnouncementModule,
    PollsModule,
    GovernanceModule,
    NotificationModule,
    AuditModule,
    RealtimeModule,
    OwnerModule,
    ThreadsModule,
    SlaModule,
    FaqModule,
    FacilityModule,
    HandoverModule,
    IntegrationsModule,
    SetupModule,
    PlatformModule,
    SafetyModule,
    ParcelModule,
    FormsModule,
    DocumentsModule,
    LostFoundModule,
    AccountingModule,
    CobModule,
    ProcurementModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
