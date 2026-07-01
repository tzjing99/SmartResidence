import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { DepositService } from './deposit.service';
import { ListDepositsDto, RecordDepositDto, RefundDepositDto } from './dto/deposit.dto';

@ApiTags('Deposits')
@ApiBearerAuth('access')
@Controller('deposits')
export class DepositController {
  constructor(private readonly deposits: DepositService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Deposit' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListDepositsDto,
  ) {
    return this.deposits.listForCondo(user, condoId, query);
  }

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Deposit' })
  forUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query() page: PaginationDto,
  ) {
    return this.deposits.listForUnit(user, unitId, page);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Deposit' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.deposits.get(user, id);
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'Deposit' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Deposit', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Record a deposit and auto-issue an official receipt' })
  record(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordDepositDto) {
    return this.deposits.record(user, dto);
  }

  @Post(':id/refund')
  @CheckAbility({ action: 'manage', subject: 'Deposit' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Deposit', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Refund or forfeit (part of) a held deposit' })
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RefundDepositDto,
  ) {
    return this.deposits.refund(user, id, dto);
  }
}
