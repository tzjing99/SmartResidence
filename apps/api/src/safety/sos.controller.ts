import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { RaiseSosDto, ResolveSosDto } from './dto/sos.dto';
import { SosService } from './sos.service';

@ApiTags('Safety / SOS')
@ApiBearerAuth('access')
@Controller('sos')
export class SosController {
  constructor(private readonly sos: SosService) {}

  @Post()
  @CheckAbility({ action: 'create', subject: 'SosAlert' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'SosAlert', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Raise a panic / SOS alert (any condo member)' })
  raise(@CurrentUser() user: AuthenticatedUser, @Body() dto: RaiseSosDto) {
    return this.sos.raise(user, dto);
  }

  @Get('mine')
  @CheckAbility({ action: 'read', subject: 'SosAlert' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() page: PaginationDto) {
    return this.sos.listMine(user, page);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'SosAlert' })
  @ApiOperation({ summary: 'Active + recent SOS alerts (management/guard)' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.sos.listForCondo(user, condoId);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'SosAlert' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.sos.get(user, id);
  }

  @Post(':id/acknowledge')
  @CheckAbility({ action: 'acknowledge', subject: 'SosAlert' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'SosAlert', resourceIdFrom: 'params.id' })
  acknowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sos.acknowledge(user, id);
  }

  @Post(':id/resolve')
  @CheckAbility({ action: 'resolve', subject: 'SosAlert' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'SosAlert', resourceIdFrom: 'params.id' })
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveSosDto,
  ) {
    return this.sos.resolve(user, id, dto);
  }

  @Post(':id/cancel')
  @CheckAbility({ action: 'cancel', subject: 'SosAlert' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'SosAlert', resourceIdFrom: 'params.id' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.sos.cancel(user, id);
  }
}
