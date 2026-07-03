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
import { CreateRecurringPassDto, UpdateRecurringPassDto } from './dto/recurring-pass.dto';
import { CheckInVisitorDto } from './dto/visitor.dto';
import { RecurringPassService } from './recurring-pass.service';

@ApiTags('Visitors')
@ApiBearerAuth('access')
@Controller('visitors/recurring-passes')
export class RecurringPassController {
  constructor(private readonly recurringPasses: RecurringPassService) {}

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'RecurringPass' })
  @ApiOperation({ summary: 'List recurring passes for a unit (resident)' })
  forUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
  ) {
    return this.recurringPasses.listForUnit(user, unitId);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'RecurringPass' })
  @ApiOperation({ summary: 'List all recurring passes in a condo (management)' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.recurringPasses.listForCondo(user, condoId);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'RecurringPass' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'RecurringPass',
    resourceIdFrom: 'response.id',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecurringPassDto) {
    return this.recurringPasses.create(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'RecurringPass' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'RecurringPass', resourceIdFrom: 'params.id' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRecurringPassDto,
  ) {
    return this.recurringPasses.update(id, user, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'RecurringPass' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'RecurringPass', resourceIdFrom: 'params.id' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.recurringPasses.remove(id, user);
  }

  @Post('verify/:pass')
  @CheckAbility({ action: 'check-in', subject: 'Visitor' })
  @ApiOperation({ summary: 'Guard verifies a recurring pass (QR or access code)' })
  verify(@CurrentUser() guard: AuthenticatedUser, @Param('pass') pass: string) {
    return this.recurringPasses.verifyByPass(pass, guard.activeCondoId ?? undefined);
  }

  @Post('check-in/:pass')
  @CheckAbility({ action: 'check-in', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'VisitorCheckIn' })
  checkIn(
    @CurrentUser() guard: AuthenticatedUser,
    @Param('pass') pass: string,
    @Body() dto: CheckInVisitorDto,
  ) {
    return this.recurringPasses.checkIn(pass, guard, dto);
  }
}
