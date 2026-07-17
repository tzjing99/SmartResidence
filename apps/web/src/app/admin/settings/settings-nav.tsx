import type { SettingsNavItem } from '@/components/settings-sub-nav';
import {
  Ban,
  Bell,
  Building2,
  FileCheck2,
  History,
  LifeBuoy,
  type LucideIcon,
  Plug,
  ReceiptText,
  ShieldCheck,
  Tags,
  UserCheck,
} from 'lucide-react';

/** A settings area grouped into a section on the hub, with icon + plain-language blurb. */
export interface SettingsArea extends SettingsNavItem {
  /** Short, non-technical description of what this area controls. */
  description: string;
  /** Who typically manages this area — shown on the hub card. */
  audience: string;
  /** Lucide icon shown on the hub card. */
  icon: LucideIcon;
  /** Section the area belongs to on the landing hub. */
  group: SettingsGroup;
}

export type SettingsGroup = 'Building setup' | 'Money' | 'Operations' | 'Access & records';

/** Section order on the hub. Empty sections (no accessible areas) are skipped. */
export const SETTINGS_GROUP_ORDER: SettingsGroup[] = [
  'Building setup',
  'Money',
  'Operations',
  'Access & records',
];

/**
 * Single source of truth for the settings areas, shared by the landing hub
 * (`page.tsx`) and the horizontal sub-nav (`layout.tsx`). Ability gating mirrors
 * `SettingsSubNav`: an area with `can` is only shown when the user has that ability.
 */
export const SETTINGS_AREAS: SettingsArea[] = [
  {
    href: '/admin/settings/unit-types',
    label: 'Unit types',
    description: 'Define layouts, sizes, and unit categories for the building.',
    audience: 'Building admins',
    icon: Building2,
    group: 'Building setup',
    can: { action: 'manage', subject: 'UnitType' },
  },
  {
    href: '/admin/settings/taxonomy',
    label: 'Defect taxonomy',
    description: 'Categories and types used to classify maintenance defects.',
    audience: 'Building admins',
    icon: Tags,
    group: 'Building setup',
    can: { action: 'manage', subject: 'DefectTaxonomy' },
  },
  {
    href: '/admin/settings/billing',
    label: 'Billing & receipts',
    description: 'Fee schedule, receipt template, and payment gateways.',
    audience: 'Finance & billing admins',
    icon: ReceiptText,
    group: 'Money',
    can: { action: 'manage', subject: 'BillingSettings' },
  },
  {
    href: '/admin/settings/einvoice',
    label: 'E-invoicing (LHDN)',
    description: 'MyInvois supplier details and LHDN submission credentials.',
    audience: 'Finance admins',
    icon: FileCheck2,
    group: 'Money',
    can: { action: 'manage', subject: 'EInvoice' },
  },
  {
    href: '/admin/settings/access-restriction',
    label: 'Arrears access',
    description:
      'Soft-block facility booking and visitor passes for units in arrears; export for ZKTeco/MAG.',
    audience: 'Finance & security admins',
    icon: Ban,
    group: 'Money',
    can: { action: 'manage', subject: 'AccessRestriction' },
  },
  {
    href: '/admin/settings/helpdesk',
    label: 'Helpdesk & SLA',
    description: 'Response-time targets and automatic ticket assignment.',
    audience: 'Operations managers',
    icon: LifeBuoy,
    group: 'Operations',
    can: { action: 'read', subject: 'SlaPolicy' },
  },
  {
    href: '/admin/settings/visitors',
    label: 'Visitors',
    description: 'Overnight stay rules and visitor registration policy.',
    audience: 'Front desk & security',
    icon: UserCheck,
    group: 'Operations',
    can: { action: 'manage-overnight-policy', subject: 'Visitor' },
  },
  {
    href: '/admin/settings/notifications',
    label: 'Notifications',
    description: 'Channels and delivery preferences for resident alerts.',
    audience: 'All admins',
    icon: Bell,
    group: 'Operations',
  },
  {
    href: '/admin/settings/integrations',
    label: 'Integrations (MCP)',
    description: 'Connect AI tools and external services via MCP.',
    audience: 'Technical admins',
    icon: Plug,
    group: 'Operations',
    can: { action: 'manage', subject: 'McpServer' },
  },
  {
    href: '/admin/settings/roles',
    label: 'Roles & access',
    description: 'Assign roles and control who can do what.',
    audience: 'Building admins',
    icon: ShieldCheck,
    group: 'Access & records',
    can: { action: 'manage', subject: 'RoleAssignment' },
  },
  {
    href: '/admin/settings/audit',
    label: 'Audit log',
    description: 'Review account, billing, and management activity.',
    audience: 'Building admins & auditors',
    icon: History,
    group: 'Access & records',
    can: { action: 'read', subject: 'AuditLog' },
  },
];

/** The sub-nav items, derived from the shared areas so both stay in sync. */
export const SETTINGS_NAV: SettingsNavItem[] = SETTINGS_AREAS.map(({ href, label, can }) => ({
  href,
  label,
  ...(can ? { can } : {}),
}));
