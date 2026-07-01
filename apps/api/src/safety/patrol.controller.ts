import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import {
  CreatePatrolCheckpointDto,
  ListPatrolCheckpointsDto,
  ListPatrolScansDto,
  PatrolScanDto,
  UpdatePatrolCheckpointDto,
} from './dto/patrol.dto';
import { PatrolService } from './patrol.service';

@ApiTags('Safety / Patrol')
@ApiBearerAuth('access')
@Controller('patrol')
export class PatrolController {
  constructor(private readonly patrol: PatrolService) {}

  @Get('condo/:condoId/checkpoints')
  @CheckAbility({ action: 'read', subject: 'PatrolCheckpoint' })
  checkpoints(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListPatrolCheckpointsDto,
  ) {
    return this.patrol.listCheckpoints(user, condoId, {
      includeInactive: query.includeInactive,
    });
  }

  @Get('condo/:condoId/scans')
  @CheckAbility({ action: 'read', subject: 'PatrolScan' })
  scans(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListPatrolScansDto,
  ) {
    return this.patrol.listScans(user, condoId, query);
  }

  @Post('checkpoints')
  @CheckAbility({ action: 'manage', subject: 'PatrolCheckpoint' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'PatrolCheckpoint',
    resourceIdFrom: 'response.id',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePatrolCheckpointDto) {
    return this.patrol.createCheckpoint(user, dto);
  }

  @Patch('checkpoints/:id')
  @CheckAbility({ action: 'manage', subject: 'PatrolCheckpoint' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'PatrolCheckpoint',
    resourceIdFrom: 'params.id',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePatrolCheckpointDto,
  ) {
    return this.patrol.updateCheckpoint(user, id, dto);
  }

  @Post('checkpoints/:id/regenerate-code')
  @CheckAbility({ action: 'manage', subject: 'PatrolCheckpoint' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'PatrolCheckpoint',
    resourceIdFrom: 'params.id',
  })
  @ApiOperation({ summary: 'Rotate the checkpoint QR token' })
  regenerate(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.patrol.regenerateCode(user, id);
  }

  @Delete('checkpoints/:id')
  @CheckAbility({ action: 'manage', subject: 'PatrolCheckpoint' })
  @Audit({
    action: AuditAction.DELETE,
    resourceType: 'PatrolCheckpoint',
    resourceIdFrom: 'params.id',
  })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.patrol.removeCheckpoint(user, id);
  }

  @Post('scan')
  @CheckAbility({ action: 'create', subject: 'PatrolScan' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'PatrolScan',
    resourceIdFrom: 'response.id',
  })
  @ApiOperation({ summary: 'Guard scans a checkpoint QR (offline-tolerant)' })
  scan(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatrolScanDto) {
    return this.patrol.scan(user, dto);
  }
}
