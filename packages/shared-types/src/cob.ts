import { z } from 'zod';

/** Commissioner of Buildings (COB) downloadable form template kinds. */
export const CobTemplateKind = z.enum([
  'ANNUAL_RETURN',
  'FINANCIAL_SUMMARY',
  'MEETING_MINUTES_COVER',
  'INSURANCE_REGISTER',
]);
export type CobTemplateKind = z.infer<typeof CobTemplateKind>;

export const COB_TEMPLATE_SLUG: Record<CobTemplateKind, string> = {
  ANNUAL_RETURN: 'annual-return',
  FINANCIAL_SUMMARY: 'financial-summary',
  MEETING_MINUTES_COVER: 'meeting-minutes-cover',
  INSURANCE_REGISTER: 'insurance-register',
};

export const COB_TEMPLATE_LABEL: Record<CobTemplateKind, string> = {
  ANNUAL_RETURN: 'Annual return summary',
  FINANCIAL_SUMMARY: 'Financial summary submission',
  MEETING_MINUTES_COVER: 'Meeting minutes cover sheet',
  INSURANCE_REGISTER: 'Insurance & fire certificate register',
};

export const COB_TEMPLATE_DESCRIPTION: Record<CobTemplateKind, string> = {
  ANNUAL_RETURN:
    'Building particulars, management committee roster, and parcel count for COB annual return filing.',
  FINANCIAL_SUMMARY:
    'Maintenance and sinking fund balances with collections vs charges for the reporting period.',
  MEETING_MINUTES_COVER:
    'Cover sheet for AGM/EGM minutes submission — meeting details to be completed before filing.',
  INSURANCE_REGISTER:
    'Blank register template for building insurance policies and fire certificate renewals.',
};

export interface CobTemplateListItem {
  kind: CobTemplateKind;
  slug: string;
  label: string;
  description: string;
  downloadPath: string;
}

export interface CobPrefillDataSource {
  field: string;
  source: string;
}

export interface CobPrefillSnapshot {
  asAtDate: string;
  organizationName: string;
  registrationNo: string | null;
  address: string;
  blockCount: number;
  unitCount: number;
  managementCommittee: Array<{ name: string; role: string; email: string | null }>;
  fundBalances: Array<{ fund: string; label: string; balance: string }>;
  reportingPeriod: { from: string; to: string } | null;
  dataSources: CobPrefillDataSource[];
}

export interface CobTemplateListResponse {
  templates: CobTemplateListItem[];
  prefill: CobPrefillSnapshot;
  disclaimer: string;
}
