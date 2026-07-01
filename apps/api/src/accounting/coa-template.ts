import { GlAccountType, LedgerFund } from '@prisma/client';

/** Malaysian JMB typical chart of accounts — seeded once per condo. */
export interface CoaTemplateRow {
  code: string;
  name: string;
  type: GlAccountType;
  fund: LedgerFund;
  parentCode?: string;
}

export const MALAYSIAN_JMB_COA: CoaTemplateRow[] = [
  // Assets — cash & receivables by fund
  { code: '1000', name: 'Cash at Bank — Maintenance', type: 'ASSET', fund: 'MAINTENANCE' },
  { code: '1010', name: 'Cash at Bank — Sinking Fund', type: 'ASSET', fund: 'SINKING_FUND' },
  { code: '1020', name: 'Cash at Bank — Deposits Held', type: 'ASSET', fund: 'DEPOSIT' },
  { code: '1100', name: 'Accounts Receivable — Maintenance', type: 'ASSET', fund: 'MAINTENANCE' },
  {
    code: '1110',
    name: 'Accounts Receivable — Sinking Fund',
    type: 'ASSET',
    fund: 'SINKING_FUND',
  },
  { code: '1120', name: 'Accounts Receivable — Other', type: 'ASSET', fund: 'GENERAL' },
  { code: '1200', name: 'Prepaid Expenses', type: 'ASSET', fund: 'GENERAL' },
  // Liabilities
  { code: '2000', name: 'Deposits Held (Refundable)', type: 'LIABILITY', fund: 'DEPOSIT' },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', fund: 'GENERAL' },
  { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY', fund: 'GENERAL' },
  // Equity / fund balances
  { code: '3000', name: 'Maintenance Fund Balance', type: 'EQUITY', fund: 'MAINTENANCE' },
  { code: '3010', name: 'Sinking Fund Balance', type: 'EQUITY', fund: 'SINKING_FUND' },
  { code: '3020', name: 'Retained Surplus', type: 'EQUITY', fund: 'GENERAL' },
  // Income
  { code: '4000', name: 'Maintenance Charges', type: 'INCOME', fund: 'MAINTENANCE' },
  {
    code: '4010',
    name: 'Sinking Fund Contributions',
    type: 'INCOME',
    fund: 'SINKING_FUND',
  },
  { code: '4020', name: 'Interest Income', type: 'INCOME', fund: 'GENERAL' },
  { code: '4030', name: 'Other Income', type: 'INCOME', fund: 'GENERAL' },
  { code: '4040', name: 'Late Payment Charges', type: 'INCOME', fund: 'MAINTENANCE' },
  // Expenses
  { code: '5000', name: 'Maintenance — Utilities', type: 'EXPENSE', fund: 'MAINTENANCE' },
  { code: '5010', name: 'Maintenance — Security', type: 'EXPENSE', fund: 'MAINTENANCE' },
  { code: '5020', name: 'Maintenance — Cleaning', type: 'EXPENSE', fund: 'MAINTENANCE' },
  { code: '5030', name: 'Maintenance — Repairs', type: 'EXPENSE', fund: 'MAINTENANCE' },
  { code: '5100', name: 'Sinking Fund — Capital Works', type: 'EXPENSE', fund: 'SINKING_FUND' },
  { code: '5200', name: 'Management Fees', type: 'EXPENSE', fund: 'GENERAL' },
  { code: '5300', name: 'Insurance', type: 'EXPENSE', fund: 'GENERAL' },
  { code: '5400', name: 'Quit Rent & Assessment', type: 'EXPENSE', fund: 'GENERAL' },
];

/** GL account codes used by auto-posting from the operational ledger. */
export const GL_AUTO_POST_CODES = {
  bank: {
    MAINTENANCE: '1000',
    SINKING_FUND: '1010',
    DEPOSIT: '1020',
    GENERAL: '1000',
  },
  receivable: {
    MAINTENANCE: '1100',
    SINKING_FUND: '1110',
    DEPOSIT: '1120',
    GENERAL: '1120',
  },
  income: {
    MAINTENANCE: '4000',
    SINKING_FUND: '4010',
    DEPOSIT: '4030',
    GENERAL: '4030',
  },
  depositsHeld: '2000',
  payable: '2100',
  expense: {
    MAINTENANCE: '5030',
    SINKING_FUND: '5100',
    DEPOSIT: '5200',
    GENERAL: '5200',
  },
} as const;
