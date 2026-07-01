import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CreateVendorDto, ListVendorsDto, UpdateVendorDto } from './dto/vendor.dto';
import { VendorService } from './vendor.service';

@ApiTags('Procurement — vendors')
@ApiBearerAuth('access')
@Controller('procurement/vendors')
export class VendorController {
  constructor(private readonly vendors: VendorService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Vendor' })
  @ApiOperation({ summary: 'List vendors for a condo' })
  listForCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListVendorsDto,
  ) {
    return this.vendors.listForCondo(user, condoId, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Vendor' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.vendors.getOne(user, id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'Vendor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Vendor', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Create a vendor' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorDto) {
    return this.vendors.create(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'Vendor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Vendor', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Update a vendor' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendors.update(user, id, dto);
  }
}
