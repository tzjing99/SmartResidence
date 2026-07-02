import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { assertCondoManagement } from '@/common/authz/assert-condo-management';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { BankReconciliationService } from './bank-reconciliation.service';
import { CoaService } from './coa.service';
import {
  CreateGlAccountDto,
  ImportBankStatementDto,
  ListJournalsQueryDto,
  MatchBankLineDto,
  PostManualJournalDto,
  UpdateGlAccountDto,
} from './dto/accounting.dto';
import { GlService } from './gl.service';

@ApiTags('General ledger')
@ApiBearerAuth('access')
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly coa: CoaService,
    private readonly gl: GlService,
    private readonly bankRecon: BankReconciliationService,
  ) {}

  // -- Chart of accounts ------------------------------------------------

  @Get('condo/:condoId/coa')
  @CheckAbility({ action: 'read', subject: 'GeneralLedger' })
  @ApiOperation({ summary: 'Chart of accounts tree (auto-seeds Malaysian JMB template)' })
  chartOfAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.coa.listTree(condoId);
  }

  @Get('condo/:condoId/bank-accounts')
  @CheckAbility({ action: 'read', subject: 'GeneralLedger' })
  @ApiOperation({ summary: 'GL cash accounts for bank reconciliation' })
  bankAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.coa.listBankAccounts(condoId);
  }

  @Post('condo/:condoId/coa')
  @CheckAbility({ action: 'manage', subject: 'GeneralLedger' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'GlAccount', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Add a GL account to the chart' })
  createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: CreateGlAccountDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.coa.createAccount(condoId, dto);
  }

  @Patch('coa/:accountId')
  @CheckAbility({ action: 'manage', subject: 'GeneralLedger' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'GlAccount',
    resourceIdFrom: 'params.accountId',
  })
  @ApiOperation({ summary: 'Update a GL account name or active flag' })
  updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body() dto: UpdateGlAccountDto,
  ) {
    return this.coa.updateAccount(user, accountId, dto);
  }

  // -- Journal entries ----------------------------------------------------

  @Get('condo/:condoId/journals')
  @CheckAbility({ action: 'read', subject: 'GeneralLedger' })
  @ApiOperation({ summary: 'List GL journal entries for a period' })
  listJournals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListJournalsQueryDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.gl.listJournals(condoId, query);
  }

  @Get('condo/:condoId/journals/:entryId')
  @CheckAbility({ action: 'read', subject: 'GeneralLedger' })
  @ApiOperation({ summary: 'Journal entry detail with lines' })
  getJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.gl.getJournal(condoId, entryId);
  }

  @Post('condo/:condoId/journals')
  @CheckAbility({ action: 'manage', subject: 'GeneralLedger' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'GlJournalEntry',
    resourceIdFrom: 'response.id',
  })
  @ApiOperation({ summary: 'Post a manual balanced journal entry' })
  postManual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: PostManualJournalDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.gl.postManual(user, condoId, dto);
  }

  // -- Bank reconciliation ----------------------------------------------

  @Get('condo/:condoId/bank-imports')
  @CheckAbility({ action: 'read', subject: 'GeneralLedger' })
  @ApiOperation({ summary: 'List bank statement imports' })
  listBankImports(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('accountId') accountId?: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.bankRecon.listImports(condoId, accountId);
  }

  @Post('condo/:condoId/bank-imports')
  @CheckAbility({ action: 'manage', subject: 'GeneralLedger' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'BankStatementImport',
    resourceIdFrom: 'response.id',
  })
  @ApiOperation({ summary: 'Import bank statement CSV for reconciliation' })
  importBankStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: ImportBankStatementDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.bankRecon.importCsv(user, condoId, dto);
  }

  @Get('condo/:condoId/bank-imports/:importId/worksheet')
  @CheckAbility({ action: 'read', subject: 'GeneralLedger' })
  @ApiOperation({ summary: 'Bank reconciliation worksheet — statement vs GL lines' })
  reconciliationWorksheet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('importId', new ParseUUIDPipe()) importId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.bankRecon.worksheet(condoId, importId);
  }

  @Post('condo/:condoId/bank-lines/:lineId/match')
  @CheckAbility({ action: 'manage', subject: 'GeneralLedger' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'BankStatementLine',
    resourceIdFrom: 'params.lineId',
  })
  @ApiOperation({ summary: 'Match or unmatch a statement line to a GL journal line' })
  matchBankLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() dto: MatchBankLineDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.bankRecon.matchLine(condoId, lineId, dto.journalLineId ?? null);
  }
}
