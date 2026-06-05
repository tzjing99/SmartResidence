import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenant.getCondo(id);
  }

  @Get(':id/units')
  @CheckAbility({ action: 'read', subject: 'Unit' })
  listUnits(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.tenant.listUnits(id, { ...pagination, search });
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
}
