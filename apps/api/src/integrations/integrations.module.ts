import { BillingModule } from '@/billing/billing.module';
import { Module } from '@nestjs/common';
import { McpConnectionController } from './mcp-connection.controller';
import { McpConnectionService } from './mcp-connection.service';

@Module({
  imports: [BillingModule],
  providers: [McpConnectionService],
  controllers: [McpConnectionController],
  exports: [McpConnectionService],
})
export class IntegrationsModule {}
