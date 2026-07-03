import { isManagementForCondo } from '@/announcement/announcement-audience';
import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LedgerFund, RoleId } from '@prisma/client';
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

  /**
   * `@CheckAbility` only proves the caller can read *some* condo's ledger —
   * CASL isn't handed the `condoId` from the URL. Every handler below must
   * additionally confirm the caller manages *this* condo before the ledger
   * service runs the query, otherwise any management user could read another
   * condo's financials by swapping the `:condoId` path segment (IDOR).
   */
  private assertManagement(user: AuthenticatedUser, condoId: string): void {
    const isSuperAdmin = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    if (isSuperAdmin || isManagementForCondo(user, condoId)) return;
    throw new ForbiddenException('Management access required');
  }

  @Get('reports/condo/:condoId/fund-summary')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Opening/closing balance per fund for a date range' })
  fundSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertManagement(user, condoId);
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    return this.ledger.fundSummary(condoId, start, end);
  }

  @Get('reports/condo/:condoId/income-expense')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Collections vs charges by fund and fee category' })
  incomeExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertManagement(user, condoId);
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    return this.ledger.incomeExpense(condoId, start, end);
  }

  @Get('reports/condo/:condoId/profit-loss')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Profit & loss (income statement) for a date range' })
  profitLoss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fund') fund?: string,
  ) {
    this.assertManagement(user, condoId);
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    const fundFilter =
      fund && (Object.values(LedgerFund) as string[]).includes(fund)
        ? (fund as LedgerFund)
        : undefined;
    return this.ledger.profitLoss(condoId, start, end, fundFilter);
  }

  @Get('reports/condo/:condoId/balance-sheet')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Balance sheet as at a single date' })
  balanceSheet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('asOf') asOf?: string,
  ) {
    this.assertManagement(user, condoId);
    const date = asOf ? new Date(asOf) : new Date();
    return this.ledger.balanceSheet(condoId, date);
  }

  @Get('reports/condo/:condoId/profit-loss.pdf')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Download profit & loss PDF for AGM / audit (management)' })
  async profitLossPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('fund') fund: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exports.profitLossPdf(user, condoId, from, to, fund);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('reports/condo/:condoId/profit-loss.csv')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Download profit & loss CSV for accountants (management)' })
  async profitLossCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('fund') fund: string | undefined,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.exports.profitLossCsv(user, condoId, from, to, fund);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('reports/condo/:condoId/balance-sheet.pdf')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Download balance sheet PDF as at date (management)' })
  async balanceSheetPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('asOf') asOf: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exports.balanceSheetPdf(user, condoId, asOf);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('reports/condo/:condoId/balance-sheet.csv')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Download balance sheet CSV for accountants (management)' })
  async balanceSheetCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('asOf') asOf: string | undefined,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.exports.balanceSheetCsv(user, condoId, asOf);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
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
  fundBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    this.assertManagement(user, condoId);
    return this.ledger.fundBalances(condoId);
  }

  @Get('reports/condo/:condoId/collections')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Collections summary for a period, grouped by fund' })
  collections(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertManagement(user, condoId);
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : now;
    return this.ledger.collectionsSummary(condoId, start, end);
  }

  @Get('reports/condo/:condoId/arrears')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Outstanding arrears bucketed by age' })
  arrears(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    this.assertManagement(user, condoId);
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
