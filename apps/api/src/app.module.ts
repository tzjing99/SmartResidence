import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { VisitorModule } from './visitor/visitor.module';
import { BillingModule } from './billing/billing.module';
import { DefectModule } from './defect/defect.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { NotificationModule } from './notification/notification.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { RealtimeModule } from './realtime/realtime.module';
import { OwnerModule } from './owner/owner.module';

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
    HealthModule,
    StorageModule,
    AuthModule,
    TenantModule,
    VisitorModule,
    BillingModule,
    DefectModule,
    AnnouncementModule,
    NotificationModule,
    AuditModule,
    RealtimeModule,
    OwnerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
