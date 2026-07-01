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

import { AnnouncementModule } from './announcement/announcement.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CacheModule } from './cache/cache.module';
import { DefectModule } from './defect/defect.module';
import { EInvoiceModule } from './einvoice/einvoice.module';
import { FacilityModule } from './facility/facility.module';
import { FaqModule } from './faq/faq.module';
import { HandoverModule } from './handover/handover.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { NotificationModule } from './notification/notification.module';
import { OwnerModule } from './owner/owner.module';
import { PollsModule } from './polls/polls.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SafetyModule } from './safety/safety.module';
import { ParcelModule } from './parcel/parcel.module';
import { FormsModule } from './forms/forms.module';
import { SetupModule } from './setup/setup.module';
import { SlaModule } from './sla/sla.module';
import { StorageModule } from './storage/storage.module';
import { TenantModule } from './tenant/tenant.module';
import { ThreadsModule } from './threads/threads.module';
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
    HealthModule,
    StorageModule,
    AuthModule,
    TenantModule,
    VisitorModule,
    BillingModule,
    EInvoiceModule,
    DefectModule,
    AnnouncementModule,
    PollsModule,
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
    SafetyModule,
    ParcelModule,
    FormsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
