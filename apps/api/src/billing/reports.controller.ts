import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { BillingExportsService } from './billing-exports.service';
import { LedgerService } from './ledger.service';

@ApiTags('Billing reports')
@ApiBearerAuth('access')
@Controller('billing')
export class ReportsController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly exports: BillingExportsService,
  ) {}

  @Get('reports/condo/:condoId/fund-summary')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Opening/closing balance per fund for a date range' })
  fundSummary(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    return this.ledger.fundSummary(condoId, start, end);
  }

  @Get('reports/condo/:condoId/income-expense')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Collections vs charges by fund and fee category' })
  incomeExpense(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    return this.ledger.incomeExpense(condoId, start, end);
  }

  @Get('reports/condo/:condoId/audit-trail.csv')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Ledger audit trail CSV with idempotency and reversal links' })
  async auditTrailCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.exports.auditTrailCsv(user, condoId, from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('condo/:condoId/exports/fund-summary.pdf')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Download fund summary PDF for AGM / audit (management)' })
  async fundSummaryPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exports.fundSummaryPdf(user, condoId, from, to);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

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

  @Get('condo/:condoId/statements/unit/:unitId.pdf')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Download unit account statement PDF for a date range (management)' })
  async unitStatementPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exports.unitStatementPdf(
      user,
      condoId,
      unitId,
      from,
      to,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('condo/:condoId/exports/collections.csv')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Export collections detail CSV for a period (management)' })
  async collectionsCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.exports.collectionsCsv(user, condoId, from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('condo/:condoId/exports/arrears.csv')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Export arrears aging detail CSV (management)' })
  async arrearsCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.exports.arrearsCsv(user, condoId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
