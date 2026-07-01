import { z } from 'zod';
import { FUND_LABELS, type LedgerFund } from './billing';

export const GlAccountType = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
export type GlAccountType = z.infer<typeof GlAccountType>;

export const GlJournalSourceType = z.enum([
  'INVOICE',
  'PAYMENT',
  'MANUAL',
  'REVERSAL',
  'VENDOR_BILL',
  'VENDOR_PAYMENT',
]);
export type GlJournalSourceType = z.infer<typeof GlJournalSourceType>;

export const GL_ACCOUNT_TYPE_LABELS: Record<GlAccountType, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity / fund balance',
  INCOME: 'Income',
  EXPENSE: 'Expense',
};

export const GL_SOURCE_TYPE_LABELS: Record<GlJournalSourceType, string> = {
  INVOICE: 'From invoice',
  PAYMENT: 'From payment',
  MANUAL: 'Manual entry',
  REVERSAL: 'Reversal',
  VENDOR_BILL: 'Vendor bill approved',
  VENDOR_PAYMENT: 'Vendor bill paid',
};

export interface GlAccountNode {
  id: string;
  code: string;
  name: string;
  type: GlAccountType;
  fund: LedgerFund;
  parentId: string | null;
  active: boolean;
  children: GlAccountNode[];
}

export interface GlJournalListItem {
  id: string;
  entryDate: string;
  description: string;
  sourceType: GlJournalSourceType;
  sourceId: string | null;
  postedBy: { id: string; name: string } | null;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
}

export interface GlJournalLineDetail {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  fund: LedgerFund;
  memo: string | null;
}

export interface GlJournalEntryDetail {
  id: string;
  entryDate: string;
  description: string;
  sourceType: GlJournalSourceType;
  sourceId: string | null;
  postedBy: { id: string; name: string } | null;
  lines: GlJournalLineDetail[];
  createdAt: string;
}

export interface BankStatementImportSummary {
  id: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  importedAt: string;
  account: { id: string; code: string; name: string; fund?: LedgerFund };
  _count?: { lines: number };
}

export interface BankReconciliationWorksheet {
  import: {
    id: string;
    periodStart: string;
    periodEnd: string;
    openingBalance: number;
    closingBalance: number;
    importedAt: string;
    account: { id: string; code: string; name: string; fund: LedgerFund };
  };
  statementLines: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    matchedJournalLineId: string | null;
    matchedJournal: {
      id: string;
      debit: number;
      credit: number;
      entryDate: string;
      entryDescription: string;
    } | null;
  }>;
  glLines: Array<{
    id: string;
    entryDate: string;
    entryDescription: string;
    sourceType: GlJournalSourceType;
    debit: number;
    credit: number;
    fund: LedgerFund;
    memo: string | null;
    matched: boolean;
  }>;
  summary: {
    statementLineCount: number;
    matchedCount: number;
    unmatchedStatementCount: number;
    unmatchedGlCount: number;
    statementMovement: number;
    glNetMovement: number;
  };
}

export type PostManualJournalInput = {
  entryDate: string;
  description: string;
  lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    fund: LedgerFund;
    memo?: string;
  }>;
  idempotencyKey?: string;
};

export type ImportBankStatementInput = {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  csv: string;
};

/** Re-export fund labels for GL UI convenience. */
export { FUND_LABELS };
