import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import {
  CreateVisitorBlacklistDto,
  GuardBlacklistCheckDto,
  UpdateVisitorBlacklistDto,
} from './dto/visitor-blacklist.dto';
import { VisitorBlacklistService } from './visitor-blacklist.service';

@ApiTags('Visitors')
@ApiBearerAuth('access')
@Controller('visitors')
export class VisitorBlacklistController {
  constructor(private readonly blacklist: VisitorBlacklistService) {}

  @Get('admin/blacklist/:condoId')
  @CheckAbility({ action: 'manage', subject: 'VisitorBlacklist' })
  @ApiOperation({ summary: 'List visitor blacklist entries for a condo' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.blacklist.listForCondo(user, condoId);
  }

  @Post('admin/blacklist/:condoId')
  @CheckAbility({ action: 'manage', subject: 'VisitorBlacklist' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'VisitorBlacklist',
    resourceIdFrom: 'response.id',
  })
  create(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVisitorBlacklistDto,
  ) {
    return this.blacklist.create(condoId, user, dto);
  }

  @Patch('admin/blacklist/:id')
  @CheckAbility({ action: 'manage', subject: 'VisitorBlacklist' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'VisitorBlacklist',
    resourceIdFrom: 'params.id',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVisitorBlacklistDto,
  ) {
    return this.blacklist.update(id, user, dto);
  }

  @Delete('admin/blacklist/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'manage', subject: 'VisitorBlacklist' })
  @Audit({
    action: AuditAction.DELETE,
    resourceType: 'VisitorBlacklist',
    resourceIdFrom: 'params.id',
  })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.blacklist.remove(id, user);
  }

  @Post('guard/blacklist-check')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @ApiOperation({ summary: 'Guard: check if visitor identifiers match the blacklist' })
  async guardCheck(@CurrentUser() guard: AuthenticatedUser, @Body() dto: GuardBlacklistCheckDto) {
    const condoId = guard.activeCondoId;
    if (!condoId) return { blocked: false };
    const match = await this.blacklist.findMatch(condoId, dto);
    return match ? { blocked: true, reason: match.reason, entryId: match.id } : { blocked: false };
  }
}
