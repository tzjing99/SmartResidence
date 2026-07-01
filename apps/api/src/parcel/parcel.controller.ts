import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CollectParcelDto, CreateParcelDto, ListParcelsDto } from './dto/parcel.dto';
import { ParcelService } from './parcel.service';

@ApiTags('Parcels')
@ApiBearerAuth('access')
@Controller('parcels')
export class ParcelController {
  constructor(private readonly parcels: ParcelService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Parcel' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListParcelsDto,
  ) {
    return this.parcels.listForCondo(user, condoId, query);
  }

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Parcel' })
  forUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query() query: ListParcelsDto,
  ) {
    return this.parcels.listForUnit(user, unitId, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Parcel' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.parcels.get(user, id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'Parcel' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Parcel', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Guard logs an incoming parcel for a unit' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateParcelDto) {
    return this.parcels.create(user, dto);
  }

  @Post(':id/collect')
  @CheckAbility({ action: 'collect', subject: 'Parcel' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Parcel', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Resident or guard marks parcel collected' })
  collect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CollectParcelDto,
  ) {
    return this.parcels.collect(user, id, dto);
  }
}
