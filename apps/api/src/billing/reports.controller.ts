import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';

@ApiTags('Billing reports')
@ApiBearerAuth('access')
@Controller('billing')
export class ReportsController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('reports/condo/:condoId/fund-balances')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Cash balance per fund (maintenance / sinking / deposits)' })
  fundBalances(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.ledger.fundBalances(condoId);
  }

  @Get('reports/condo/:condoId/collections')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Collections summary for a period, grouped by fund' })
  collections(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    return this.ledger.collectionsSummary(condoId, start, end);
  }

  @Get('reports/condo/:condoId/arrears')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Outstanding arrears bucketed by age' })
  arrears(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.ledger.arrearsAging(condoId);
  }

  @Get('statements/unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Per-unit account statement with running balance' })
  unitStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
  ) {
    return this.ledger.unitStatementForUser(user, unitId);
  }
}
