import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { SetMcpServerEnabledDto, UpsertMcpServerDto } from './dto/mcp-connection.dto';
import { McpConnectionService } from './mcp-connection.service';

@ApiTags('Integrations')
@ApiBearerAuth('access')
@Controller()
export class McpConnectionController {
  constructor(private readonly mcp: McpConnectionService) {}

  @Get('settings/condo/:condoId/integrations/mcp')
  @CheckAbility({ action: 'read', subject: 'McpServer' })
  @ApiOperation({ summary: 'List MCP server connections (secrets never returned)' })
  list(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.mcp.listForCondo(condoId);
  }

  @Put('settings/condo/:condoId/integrations/mcp')
  @CheckAbility({ action: 'manage', subject: 'McpServer' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'McpServerConnection',
    resourceIdFrom: 'params.condoId',
  })
  @ApiOperation({ summary: 'Create or update an MCP server connection' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpsertMcpServerDto,
  ) {
    return this.mcp.upsert(condoId, dto, user.id);
  }

  @Post('settings/condo/:condoId/integrations/mcp/:id/test')
  @CheckAbility({ action: 'manage', subject: 'McpServer' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'McpServerConnection',
    resourceIdFrom: 'params.id',
  })
  @ApiOperation({ summary: 'Test MCP server handshake (initialize + tools/list)' })
  test(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mcp.testConnection(condoId, id);
  }

  @Post('settings/condo/:condoId/integrations/mcp/:id/enabled')
  @CheckAbility({ action: 'manage', subject: 'McpServer' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'McpServerConnection',
    resourceIdFrom: 'params.id',
  })
  @ApiOperation({ summary: 'Enable or disable an MCP connection' })
  setEnabled(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetMcpServerEnabledDto,
  ) {
    return this.mcp.setEnabled(condoId, id, dto.enabled);
  }

  @Delete('settings/condo/:condoId/integrations/mcp/:id')
  @CheckAbility({ action: 'manage', subject: 'McpServer' })
  @Audit({
    action: AuditAction.DELETE,
    resourceType: 'McpServerConnection',
    resourceIdFrom: 'params.id',
  })
  @ApiOperation({ summary: 'Remove an MCP server connection' })
  remove(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mcp.remove(condoId, id);
  }
}
