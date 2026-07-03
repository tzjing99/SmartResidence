import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListUnitsQueryDto, UpdateResidentContactDto } from './dto/tenant.dto';
import { TenantService } from './tenant.service';

@ApiTags('Tenancy')
@ApiBearerAuth('access')
@Controller('condos')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get('mine')
  @ApiOperation({ summary: 'List condos the current user has access to' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.tenant.listMyCondos(user);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Condo' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenant.getCondo(user, id);
  }

  @Get(':id/units')
  @CheckAbility({ action: 'read', subject: 'Unit' })
  listUnits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListUnitsQueryDto,
  ) {
    return this.tenant.listUnits(user, id, query);
  }

  @Get(':id/blocks')
  @CheckAbility({ action: 'read', subject: 'Block' })
  listBlocks(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenant.listBlocks(user, id);
  }
}

@ApiTags('Tenancy')
@ApiBearerAuth('access')
@Controller('units')
export class UnitController {
  constructor(private readonly tenant: TenantService) {}

  @Get('mine')
  @ApiOperation({ summary: 'List units the current user owns or rents' })
  myUnits(@CurrentUser() user: AuthenticatedUser) {
    return this.tenant.getMyUnits(user);
  }

  @Get(':unitId/residents/:userId')
  @CheckAbility({ action: 'read', subject: 'User' })
  @ApiOperation({ summary: 'Management view of a resident contact record (audited)' })
  residentContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.tenant.viewResidentContact(user, unitId, userId);
  }

  @Patch(':unitId/residents/:userId')
  @CheckAbility({ action: 'update', subject: 'User' })
  @ApiOperation({ summary: 'Management correction of resident name/email/phone' })
  updateResidentContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateResidentContactDto,
  ) {
    return this.tenant.updateResidentContact(user, unitId, userId, dto);
  }
}
