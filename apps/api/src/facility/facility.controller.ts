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
  AvailabilityQueryDto,
  CreateFacilityDto,
  ListFacilitiesDto,
  UpdateFacilityDto,
} from './dto/facility.dto';
import { FacilityService } from './facility.service';

@ApiTags('Facilities')
@ApiBearerAuth('access')
@Controller('facilities')
export class FacilityController {
  constructor(private readonly facilities: FacilityService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Facility' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListFacilitiesDto,
  ) {
    return this.facilities.listForCondo(user, condoId, query);
  }

  @Get(':id/availability')
  @CheckAbility({ action: 'read', subject: 'Facility' })
  @ApiOperation({ summary: 'Free/taken slots for a facility on a given day' })
  availability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.facilities.availability(user, id, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Facility' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.facilities.get(user, id);
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'Facility' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Facility', resourceIdFrom: 'response.id' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFacilityDto) {
    return this.facilities.create(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'manage', subject: 'Facility' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Facility', resourceIdFrom: 'params.id' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFacilityDto,
  ) {
    return this.facilities.update(user, id, dto);
  }

  @Delete(':id')
  @CheckAbility({ action: 'manage', subject: 'Facility' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'Facility', resourceIdFrom: 'params.id' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.facilities.remove(user, id);
  }
}
