import { Badge, Button, Card } from '@smartresidence/ui-web';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  GitBranch,
  Landmark,
  LayoutDashboard,
  Lock,
  MessagesSquare,
  Plug,
  QrCode,
  Receipt,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

type Audience = 'Residents' | 'Management' | 'Everyone';

const proFeatures: Array<{
  icon: typeof Receipt;
  title: string;
  body: string;
  audience: Audience;
  tag?: string;
  featured?: boolean;
}> = [
  {
    icon: Plug,
    title: 'AI tool connections (MCP)',
    body: 'A Malaysian condo-software first: connect approved AI assistants to your building through the open Model Context Protocol — credentials encrypted, every connection tested, and management in full control.',
    audience: 'Management',
    tag: 'New',
    featured: true,
  },
  {
    icon: ScanLine,
    title: 'Smart Residence Gate',
    body: 'A connected guardhouse: residents invite guests, guards scan a QR pass to check them in and out, and owners get a transparent arrival record.',
    audience: 'Everyone',
  },
  {
    icon: BrainCircuit,
    title: 'Smart request prioritization',
    body: 'The system learns from requests your team has already resolved, so new complaints are ranked by urgency and sent to the right people automatically.',
    audience: 'Management',
  },
  {
    icon: Wallet,
    title: 'Advance maintenance credit',
    body: 'Residents can pay ahead online, and the amount is saved as credit that is automatically used to settle their next maintenance bill.',
    audience: 'Residents',
  },
  {
    icon: GitBranch,
    title: 'Automation you can watch',
    body: 'A simple status board shows what the system did and what is scheduled next — billing runs, overdue checks, and reminders — so nothing happens behind your back.',
    audience: 'Management',
  },
  {
    icon: Eye,
    title: 'Who viewed me',
    body: 'When management opens a resident record it is audited and the resident is notified in real time. Transparency is a built-in feature.',
    audience: 'Residents',
  },
  {
    icon: Landmark,
    title: 'Fund-separated accounting',
    body: 'A ledger that keeps maintenance and sinking fund distinct, with collections, arrears aging, and auditor-ready CSV exports.',
    audience: 'Management',
  },
];

const audienceTone: Record<Audience, 'info' | 'success' | 'neutral'> = {
  Residents: 'success',
  Management: 'info',
  Everyone: 'neutral',
};

const residentFeatures = [
  {
    icon: CreditCard,
    title: 'Pay in a few taps',
    body: 'See exactly what is owed with a clear breakdown, then pay online — FPX, e-wallet, or card — and get an official receipt instantly.',
  },
  {
    icon: Wallet,
    title: 'Prepay and never miss a bill',
    body: 'Top up maintenance credit in advance; it is applied to your next invoice automatically, so you stay ahead without thinking about it.',
  },
  {
    icon: QrCode,
    title: 'Invite guests with a QR pass',
    body: 'Pre-register visitors from your phone and share a QR code. The guard scans it at the gate — no waiting, no phone calls.',
  },
  {
    icon: Wrench,
    title: 'Report an issue with photos',
    body: 'Snap a defect, add a note, and track it from reported to resolved. You confirm when it is actually fixed — not before.',
  },
  {
    icon: BellRing,
    title: 'Announcements you cannot miss',
    body: 'Building notices arrive as real-time alerts, formatted and easy to read, with read-acknowledgement when it matters.',
  },
  {
    icon: Eye,
    title: 'See who viewed your data',
    body: 'If management opens your record, you are notified and it is logged. Your privacy is visible and yours to check.',
  },
];

const stats = [
  { value: '2 portals', label: 'Resident + management, kept separate' },
  { value: '3 gateways', label: 'Fiuu, iPay88, Stripe' },
  { value: 'Real-time', label: 'Live notifications & audit trail' },
  { value: 'Audited', label: 'Every money action is logged' },
];

const moneyFeatures = [
  {
    icon: Receipt,
    title: 'Invoices with real receipts',
    body: 'Every maintenance fee shows its formula and issues an official receipt PDF. No hidden charges, gap-free numbering, and duplicate-safe billing.',
  },
  {
    icon: CalendarClock,
    title: 'Automatic billing cycles',
    body: 'Generate monthly invoices from each unit type\u2019s fee schedule automatically, with preview, run-now, and a clear status view for admins.',
  },
  {
    icon: Wallet,
    title: 'Advance maintenance credit',
    body: 'Residents prepay RM100\u2013RM1000 (or any amount) through the gateway. Confirmed payments become prepaid credit that offsets the next invoice.',
  },
  {
    icon: Landmark,
    title: 'Accounting that stays honest',
    body: 'Fund-separated ledger for maintenance vs sinking fund, collections, arrears aging, deposits, and CSV exports for AGM and auditors.',
  },
  {
    icon: CreditCard,
    title: 'Secure gateway payments',
    body: 'Signed callbacks, amount-mismatch review, and encrypted per-condo credentials. Credit is only granted after the gateway confirms.',
  },
  {
    icon: FileText,
    title: 'Deposits, done properly',
    body: 'Track renovation and access-card deposits across every unit, with partial refunds, forfeitures, and held-liability totals.',
  },
];

const operationFeatures = [
  {
    icon: CalendarClock,
    title: 'Visitor passes',
    body: 'Pre-register guests, generate QR passes, and let guards check them in. Owners always know who arrived and when.',
  },
  {
    icon: Wrench,
    title: 'Defects that get fixed',
    body: 'Photo, location, a status timeline, and a chat thread with management \u2014 so nothing gets lost in email.',
  },
  {
    icon: MessagesSquare,
    title: 'Helpdesk threads',
    body: 'Resident-driven conversations with SLA tracking, internal notes, and resident sign-off before a ticket closes.',
  },
  {
    icon: BellRing,
    title: 'Announcements',
    body: 'Target the whole condo, specific blocks, or named units. Residents only see what applies to them, with acknowledgements.',
  },
];

const trustFeatures = [
  {
    icon: Eye,
    title: 'Who viewed me',
    body: 'When management opens a resident record, it is audited and the resident is notified in real time. Transparency by default.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-scoped access',
    body: 'Super admin, management, staff, guard, owner, tenant, household \u2014 each sees only what its role allows, enforced on the server.',
  },
  {
    icon: Lock,
    title: 'Own your data',
    body: 'Open-source and self-hostable. Encrypted gateway secrets, per-condo isolation, and a full audit log you control.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Set up your condo',
    body: 'Add blocks, units, and unit types. Configure fee rates, receipt templates, and payment gateways in one settings hub.',
  },
  {
    step: '02',
    title: 'Automate the money',
    body: 'Turn on automatic billing, add extra charges like fire insurance or quit rent, and let the system issue invoices on schedule.',
  },
  {
    step: '03',
    title: 'Residents self-serve',
    body: 'Residents pay online, prepay in advance, register visitors, raise defects, and track everything from their own dashboard.',
  },
];

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Receipt;
  title: string;
  body: string;
}) {
  return (
    <Card className="h-full transition-shadow hover:shadow-lg">
      <span className="grid size-11 place-items-center rounded-2xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed sr-muted">{body}</p>
    </Card>
  );
}

function GlowBlobs() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 hidden size-40 rounded-full bg-[rgb(var(--sr-coral)/0.16)] blur-3xl sm:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-8 hidden size-44 rounded-full bg-[rgb(var(--sr-coral)/0.12)] blur-3xl sm:block"
      />
    </>
  );
}

/** Resident invoice + advance maintenance credit preview. */
function InvoiceMockup() {
  const creditChips = ['RM 100', 'RM 200', 'RM 400', 'RM 1000'];
  return (
    <div className="relative">
      <GlowBlobs />

      {/* Invoice */}
      <Card className="relative z-10 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="size-4 text-[rgb(var(--sr-coral))]" />
            Maintenance — July 2026
          </div>
          <Badge tone="warning">
            <Clock className="size-3" />
            Due Jul 15
          </Badge>
        </div>
        <div className="mt-1 text-xs sr-muted">Unit A-05-2 · Block A · Aisyah binti Rahman</div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="sr-muted">Maintenance fee</span>
            <span className="font-medium">RM 250.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="sr-muted">Sinking fund</span>
            <span className="font-medium">RM 50.00</span>
          </div>
          <div className="flex items-center justify-between border-t border-[rgb(var(--sr-border))]/70 pt-2">
            <span className="font-semibold">Total due</span>
            <span className="text-lg font-bold">RM 300.00</span>
          </div>
        </div>

        <Button className="mt-4 w-full">
          <CreditCard className="size-4" />
          Pay now
        </Button>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] sr-muted">
          <FileText className="size-3.5" />
          Last receipt · RCPT-2026-000001
        </div>
      </Card>

      {/* Advance maintenance credit */}
      <Card className="relative z-10 mt-4 rotate-1 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-[rgb(var(--sr-coral))]" />
            Advance maintenance credit
          </div>
          <span className="text-sm font-semibold text-emerald-600">+ RM 400</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {creditChips.map((amt) => (
            <span
              key={amt}
              className={
                amt === 'RM 400'
                  ? 'rounded-full border border-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral)/0.1)] px-3 py-1 text-xs font-medium text-[rgb(var(--sr-coral))]'
                  : 'rounded-full border border-[rgb(var(--sr-border))] px-3 py-1 text-xs sr-muted'
              }
            >
              {amt}
            </span>
          ))}
        </div>
        <div className="mt-3 text-xs sr-muted">
          Auto-applied to next invoice · granted only after the gateway confirms
        </div>
      </Card>

      {/* Floating: payment confirmed */}
      <Card className="absolute -right-4 -top-6 z-20 hidden w-56 -rotate-2 shadow-xl sm:block">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Payment confirmed</span>
          <Badge tone="success">
            <CheckCircle2 className="size-3" />
            Paid
          </Badge>
        </div>
        <p className="mt-1 text-xs sr-muted">RM 300.00 via Fiuu · FPX · receipt issued</p>
      </Card>
    </div>
  );
}

/** CI/CD-style automation status board. */
function PipelineMockup() {
  const stages = [
    {
      icon: CheckCircle2,
      title: 'Generate invoices',
      sub: '120 created · 0 skipped',
      status: 'Succeeded',
      tone: 'success',
      time: '09:00',
    },
    {
      icon: CheckCircle2,
      title: 'Issue receipt PDFs',
      sub: '118 issued · gap-free',
      status: 'Succeeded',
      tone: 'success',
      time: '09:02',
    },
    {
      icon: Clock,
      title: 'Send reminders',
      sub: '42 residents notified',
      status: 'Running',
      tone: 'info',
      time: 'now',
    },
    {
      icon: CalendarClock,
      title: 'Overdue sweep',
      sub: 'flags arrears aging',
      status: 'Scheduled',
      tone: 'neutral',
      time: 'Jul 16',
    },
  ] as const;

  return (
    <div className="relative">
      <GlowBlobs />

      <Card className="relative z-10 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch className="size-4 text-[rgb(var(--sr-coral))]" />
            Automation status · July run
          </div>
          <Badge tone="success">Healthy</Badge>
        </div>

        <div className="mt-4 space-y-2.5">
          {stages.map((s) => (
            <div key={s.title} className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
                    <s.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.title}</div>
                    <div className="truncate text-xs sr-muted">{s.sub}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={s.tone}>{s.status}</Badge>
                  <span className="text-[11px] tabular-nums sr-muted">{s.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] sr-muted">
          <ShieldCheck className="size-3.5" />
          Never double-charges · re-running is always safe
        </div>
      </Card>

      {/* Floating: run summary */}
      <Card className="absolute -bottom-8 -right-4 z-20 hidden w-52 rotate-1 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-[rgb(var(--sr-coral))]" />
          <span className="text-sm font-semibold">Latest run</span>
        </div>
        <p className="mt-1 text-xs sr-muted">
          <span className="font-semibold text-emerald-600">120 invoices</span> created in 41s
        </p>
      </Card>
    </div>
  );
}

/** Fund-separated ledger with collections vs arrears and CSV export. */
function LedgerMockup() {
  return (
    <div className="relative">
      <GlowBlobs />

      <Card className="relative z-10 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Landmark className="size-4 text-[rgb(var(--sr-coral))]" />
            Fund ledger · Acacia Residence
          </div>
          <Button variant="ghost" size="sm">
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
            <div className="text-xs sr-muted">Maintenance fund</div>
            <div className="mt-1 text-lg font-bold">RM 128,940</div>
          </div>
          <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
            <div className="text-xs sr-muted">Sinking fund</div>
            <div className="mt-1 text-lg font-bold">RM 76,300</div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="sr-muted">Collected in July</span>
            <span className="font-semibold text-emerald-600">RM 41,280 · 96%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--sr-border))]/60">
            <div className="h-full w-[96%] rounded-full bg-[rgb(var(--sr-coral))]" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 sr-muted">
              <AlertTriangle className="size-3.5" />
              Arrears aging
            </span>
            <span className="font-medium">RM 6,120</span>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="sr-muted">RCPT-2026-000001 · A-05-2 payment</span>
            <span className="font-medium text-emerald-600">+ RM 300.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="sr-muted">INV-2026-07-0421 · B-12-3 maintenance</span>
            <span className="font-medium">RM 320.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="sr-muted">DEP · B-12-3 renovation (held)</span>
            <span className="font-medium">RM 500.00</span>
          </div>
        </div>
      </Card>

      {/* Floating: auditor-ready */}
      <Card className="absolute -left-5 -bottom-8 z-20 hidden w-52 -rotate-2 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[rgb(var(--sr-coral))]" />
          <span className="text-sm font-semibold">Auditor-ready</span>
        </div>
        <p className="mt-1 text-xs sr-muted">Funds kept distinct · every entry logged with actor</p>
      </Card>
    </div>
  );
}

/** Smart Residence Gate live board + defect ticket flow. */
function GateMockup() {
  const arrivals = [
    {
      icon: UserCheck,
      name: 'Nurul Huda → A-05-2',
      meta: 'Checked in 2:14 PM · Guard Hafiz',
      status: 'On-site',
      tone: 'success',
    },
    {
      icon: QrCode,
      name: 'Lalamove delivery → B-12-3',
      meta: 'Walk-in 2:41 PM · owner notified',
      status: 'Walk-in',
      tone: 'info',
    },
    {
      icon: Clock,
      name: 'Encik Zulkifli → A-08-1',
      meta: 'Pre-registered · expected 6:30 PM',
      status: 'Expected',
      tone: 'neutral',
    },
  ] as const;

  return (
    <div className="relative">
      <GlowBlobs />

      {/* Live gate board */}
      <Card className="relative z-10 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ScanLine className="size-4 text-[rgb(var(--sr-coral))]" />
            Smart Residence Gate · live board
          </div>
          <Badge tone="success">3 on-site</Badge>
        </div>

        <div className="mt-4 space-y-2.5">
          {arrivals.map((a) => (
            <div
              key={a.name}
              className="flex items-center justify-between gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
                  <a.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs sr-muted">{a.meta}</div>
                </div>
              </div>
              <Badge tone={a.tone}>{a.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Defect ticket with ML priority + timeline */}
      <Card className="relative z-10 mt-4 rotate-1 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="size-4 text-[rgb(var(--sr-coral))]" />
            Defect · DFX-2041
          </div>
          <Badge tone="danger">
            <AlertTriangle className="size-3" />
            High priority
          </Badge>
        </div>
        <div className="mt-2 text-sm font-medium">Water leak — lobby ceiling, Block A</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs sr-muted">
          <BrainCircuit className="size-3.5 text-[rgb(var(--sr-coral))]" />
          Auto-routed → Plumbing team · ranked from past requests
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <Badge tone="success">
            <CheckCircle2 className="size-3" />
            Reported
          </Badge>
          <ArrowRight className="size-3 shrink-0 text-[rgb(var(--sr-coral))]" />
          <Badge tone="success">
            <CheckCircle2 className="size-3" />
            Assigned
          </Badge>
          <ArrowRight className="size-3 shrink-0 text-[rgb(var(--sr-coral))]" />
          <Badge tone="info">
            <Clock className="size-3" />
            In progress
          </Badge>
        </div>
      </Card>

      {/* Floating: owner notified */}
      <Card className="absolute -right-4 -top-6 z-20 hidden w-52 -rotate-2 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[rgb(var(--sr-coral)/0.6)]" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[rgb(var(--sr-coral))]" />
          </span>
          <span className="text-sm font-semibold">Owner notified</span>
        </div>
        <p className="mt-1 text-xs sr-muted">A guest checked in at your unit · just now</p>
      </Card>
    </div>
  );
}

/** MCP integrations: connected AI tool servers with encrypted, tested connections. */
function McpMockup() {
  const servers = [
    {
      icon: Wrench,
      name: 'Building ops tools',
      meta: 'Streamable HTTP · 6 tools available',
      status: 'Connected',
      tone: 'success',
    },
    {
      icon: FileText,
      name: 'Document search',
      meta: 'HTTP + SSE · bylaws & minutes',
      status: 'Enabled',
      tone: 'success',
    },
    {
      icon: MessagesSquare,
      name: 'Helpdesk copilot',
      meta: 'Handshake verified · awaiting enable',
      status: 'Tested',
      tone: 'info',
    },
  ] as const;

  return (
    <div className="relative">
      <GlowBlobs />

      <Card className="relative z-10 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plug className="size-4 text-[rgb(var(--sr-coral))]" />
            Integrations · MCP servers
          </div>
          <Badge tone="success">2 enabled</Badge>
        </div>

        <div className="mt-4 space-y-2.5">
          {servers.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
                  <s.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="truncate text-xs sr-muted">{s.meta}</div>
                </div>
              </div>
              <Badge tone={s.tone}>{s.status}</Badge>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] sr-muted">
          <Lock className="size-3.5" />
          Tokens encrypted at rest · never sent to the browser
        </div>
      </Card>

      {/* Floating: enable gate */}
      <Card className="absolute -bottom-8 -left-4 z-20 hidden w-56 -rotate-2 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[rgb(var(--sr-coral))]" />
          <span className="text-sm font-semibold">Tested before enabled</span>
        </div>
        <p className="mt-1 text-xs sr-muted">
          A connection must pass a live handshake before management can turn it on
        </p>
      </Card>
    </div>
  );
}

/** Resident phone experience: pay, prepay, quick actions, live notice. */
function ResidentAppMockup() {
  const quickActions = [
    { icon: QrCode, label: 'Invite' },
    { icon: Wrench, label: 'Report' },
    { icon: CreditCard, label: 'Prepay' },
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <GlowBlobs />

      {/* Phone frame */}
      <div className="relative z-10 rounded-[2.25rem] border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] p-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[rgb(var(--sr-border))]" />
        <div className="space-y-3 rounded-3xl bg-[rgb(var(--sr-bg))]/60 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sr-muted">Good evening</div>
              <div className="text-sm font-semibold">Aisyah · A-05-2</div>
            </div>
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[rgb(var(--sr-coral)/0.6)]" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[rgb(var(--sr-coral))]" />
            </span>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3">
            <div className="text-xs sr-muted">Maintenance — July 2026</div>
            <div className="mt-1 flex items-end justify-between">
              <div className="text-2xl font-bold">RM 300.00</div>
              <Badge tone="warning">Due Jul 15</Badge>
            </div>
            <div className="mt-3 w-full rounded-xl bg-[rgb(var(--sr-coral))] py-2 text-center text-sm font-semibold text-white">
              Pay now
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-emerald-600">
              <Wallet className="size-3" />
              RM 100 prepaid credit applied
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((a) => (
              <div
                key={a.label}
                className="flex flex-col items-center gap-1 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-2"
              >
                <a.icon className="size-4 text-[rgb(var(--sr-coral))]" />
                <span className="text-[11px] font-medium">{a.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3">
            <BellRing className="mt-0.5 size-4 shrink-0 text-[rgb(var(--sr-coral))]" />
            <div className="min-w-0">
              <div className="text-xs font-semibold">Water maintenance tomorrow</div>
              <div className="text-[11px] sr-muted">10:00 AM – 2:00 PM · tap to acknowledge</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating: receipt */}
      <Card className="absolute -bottom-6 -right-4 z-20 hidden w-48 rotate-2 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-[rgb(var(--sr-coral))]" />
          <span className="text-sm font-semibold">Receipt issued</span>
        </div>
        <p className="mt-1 text-xs sr-muted">RCPT-2026-000128 · emailed instantly</p>
      </Card>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[rgb(var(--sr-bg))]">
      <div className="container-page">
        <header className="flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">
            Smart<span className="text-coral-500">Residence</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/features">
              <Button variant="ghost">Features</Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button>
                Get started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </nav>
        </header>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-80 max-w-5xl rounded-full bg-[rgb(var(--sr-coral)/0.16)] blur-3xl"
        />
        <div className="container-page relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge tone="primary" className="h-7 px-3">
              <Sparkles className="size-3.5" />
              Condo management, finally on your side
            </Badge>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Run your building
              <br />
              like <span className="text-coral-500">a modern product.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg sr-muted">
              SmartResidence brings billing, payments, deposits, visitors, defects, and resident
              communication into one transparent platform — built for residents and management
              alike.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto">
                  Try the demo condo
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Explore all features
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs sr-muted">
              Demo logins use password{' '}
              <code className="rounded bg-[rgb(var(--sr-border)/0.4)] px-1.5 py-0.5">
                Demo!2026
              </code>{' '}
              — e.g. admin@acacia.demo or owner@acacia.demo
            </p>
          </div>

          {/* Product collage */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 hidden size-40 rounded-full bg-[rgb(var(--sr-coral)/0.18)] blur-3xl sm:block"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-12 -left-8 hidden size-44 rounded-full bg-[rgb(var(--sr-coral)/0.12)] blur-3xl sm:block"
            />

            {/* Primary: fund-separated management dashboard */}
            <Card className="relative z-10 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <LayoutDashboard className="size-4 text-[rgb(var(--sr-coral))]" />
                  Acacia Residence · Management
                </div>
                <Badge tone="success">Live</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs sr-muted">
                    <Landmark className="size-3.5" />
                    Maintenance fund
                  </div>
                  <div className="mt-1 text-lg font-bold">RM 128,940</div>
                </div>
                <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs sr-muted">
                    <Landmark className="size-3.5" />
                    Sinking fund
                  </div>
                  <div className="mt-1 text-lg font-bold">RM 76,300</div>
                </div>
                <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs sr-muted">
                    <TrendingUp className="size-3.5" />
                    Collection rate
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-emerald-600">96%</span>
                    <span className="text-xs sr-muted">this month</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs sr-muted">
                    <AlertTriangle className="size-3.5" />
                    Arrears aging
                  </div>
                  <div className="mt-1 text-lg font-bold">RM 6,120</div>
                </div>
              </div>

              {/* Invoice automation pipeline strip */}
              <div className="mt-3 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium sr-muted">
                    <GitBranch className="size-3.5" />
                    Invoice automation
                  </div>
                  <span className="text-[11px] sr-muted">July run</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge tone="success">
                    <CheckCircle2 className="size-3" />
                    Generate
                  </Badge>
                  <ArrowRight className="size-3 shrink-0 text-[rgb(var(--sr-coral))]" />
                  <Badge tone="success">
                    <CheckCircle2 className="size-3" />
                    Notify
                  </Badge>
                  <ArrowRight className="size-3 shrink-0 text-[rgb(var(--sr-coral))]" />
                  <Badge tone="info">
                    <Clock className="size-3" />
                    Overdue check
                  </Badge>
                </div>
              </div>

              {/* Advance credit accent */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-[rgb(var(--sr-bg))]/70 p-3 text-sm">
                <span className="flex items-center gap-1.5 sr-muted">
                  <Wallet className="size-4 text-[rgb(var(--sr-coral))]" />
                  Prepaid credit applied to A-05-2
                </span>
                <span className="font-semibold text-emerald-600">+ RM 400</span>
              </div>
            </Card>

            {/* Smart Residence Gate visitor pass */}
            <Card className="relative z-10 mt-4 rotate-1 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ScanLine className="size-4 text-[rgb(var(--sr-coral))]" />
                  Smart Residence Gate
                </div>
                <Badge tone="success">
                  <UserCheck className="size-3" />
                  Checked in
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]">
                  <QrCode className="size-10 text-[rgb(var(--sr-coral))]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Nurul Huda</div>
                  <div className="text-xs sr-muted">Visiting A-05-2 · Block A</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs sr-muted">
                    <Clock className="size-3.5" />
                    2:14 PM · scanned by Guard Hafiz
                  </div>
                </div>
              </div>
            </Card>

            {/* Floating: smart triage */}
            <Card className="absolute -top-6 -right-4 z-20 hidden w-60 -rotate-2 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
                  <BrainCircuit className="size-4" />
                </span>
                <span className="text-sm font-semibold">Smart triage</span>
              </div>
              <div className="mt-2 text-sm font-medium">Water leak — lobby</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="danger">
                  <AlertTriangle className="size-3" />
                  High priority
                </Badge>
                <Badge tone="neutral">Auto-routed → Plumbing</Badge>
              </div>
            </Card>

            {/* Floating: realtime who-viewed-me toast */}
            <Card className="absolute -bottom-8 -left-5 z-20 hidden w-60 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[rgb(var(--sr-coral)/0.6)]" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-[rgb(var(--sr-coral))]" />
                </span>
                <Eye className="size-4 text-[rgb(var(--sr-coral))]" />
                <span className="text-sm font-semibold">Who viewed me</span>
              </div>
              <p className="mt-1 text-xs sr-muted">
                Management opened your contact record · just now
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container-page">
        <div className="grid grid-cols-2 gap-4 rounded-3xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] p-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-[rgb(var(--sr-coral))]">{s.value}</div>
              <div className="mt-1 text-xs sr-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pro features */}
      <section className="container-page">
        <div className="rounded-3xl border border-[rgb(var(--sr-coral)/0.3)] bg-[rgb(var(--message-mgmt-coral-bg))]/50 p-6 sm:p-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <Badge tone="primary" className="h-7 px-3">
                <Sparkles className="size-3.5" />
                Only in SmartResidence
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                The pro features that set us apart
              </h2>
              <p className="mt-2 sr-muted">
                Capabilities most condo apps simply do not have — and every one is built for the
                people who actually use it, residents and management alike.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="sr-muted">Built for:</span>
                {(['Residents', 'Management', 'Everyone'] as const).map((a) => (
                  <Badge key={a} tone={audienceTone[a]}>
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
            <Link href="/features" className="shrink-0">
              <Button variant="secondary">
                See all features
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {proFeatures.map((f) => (
              <Card
                key={f.title}
                className={`group relative flex h-full flex-col overflow-hidden bg-[rgb(var(--sr-card))] transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                  f.featured
                    ? 'md:col-span-2 border-[rgb(var(--sr-coral)/0.5)] bg-gradient-to-br from-[rgb(var(--sr-coral)/0.12)] to-transparent'
                    : ''
                }`}
              >
                {/* top accent */}
                <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-[rgb(var(--sr-coral))] transition-transform duration-200 group-hover:scale-x-100" />

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`grid place-items-center rounded-2xl bg-[rgb(var(--sr-coral))] text-white shadow-sm transition-transform duration-200 group-hover:scale-110 ${
                      f.featured ? 'size-14' : 'size-11'
                    }`}
                  >
                    <f.icon className={f.featured ? 'size-7' : 'size-5'} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    {f.tag ? <Badge tone="danger">{f.tag}</Badge> : null}
                    <Badge tone="primary">
                      <Sparkles className="size-3" />
                      Pro
                    </Badge>
                  </div>
                </div>

                <h3
                  className={`mt-4 font-semibold ${f.featured ? 'text-xl sm:text-2xl' : 'text-lg'}`}
                >
                  {f.title}
                </h3>
                <p
                  className={`mt-2 flex-1 leading-relaxed sr-muted ${
                    f.featured ? 'text-base' : 'text-sm'
                  }`}
                >
                  {f.body}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-[rgb(var(--sr-border))]/60 pt-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide sr-muted">
                    For
                  </span>
                  <Badge tone={audienceTone[f.audience]}>{f.audience}</Badge>
                  {f.featured ? (
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--sr-coral))]">
                      <Sparkles className="size-3" />
                      Malaysian-first
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Resident experience */}
      <section className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="lg:order-2">
            <Badge tone="success" className="h-7 px-3">
              <Smartphone className="size-3.5" />
              Made for residents
            </Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              An app residents actually enjoy using
            </h2>
            <p className="mt-2 sr-muted">
              The people who live in your building get a fast, friendly experience — pay, prepay,
              invite guests, report issues, and stay informed, all from their phone.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {residentFeatures.map((f) => (
                <div key={f.title} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
                    <f.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed sr-muted">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <Zap className="size-4 text-[rgb(var(--sr-coral))]" />
                Web &amp; mobile apps
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <BellRing className="size-4 text-[rgb(var(--sr-coral))]" />
                Real-time notifications
              </span>
            </div>
          </div>
          <div className="lg:order-1">
            <ResidentAppMockup />
          </div>
        </div>
      </section>

      {/* MCP integrations band */}
      <section className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-xl">
            <Badge tone="primary" className="h-7 px-3">
              <Sparkles className="size-3.5" />A Malaysian condo-software first
            </Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Connect AI assistants to your building — safely
            </h2>
            <p className="mt-2 sr-muted">
              SmartResidence speaks the open Model Context Protocol (MCP), so management can plug
              approved AI tools straight into the building's data — billing lookups, visitor logs,
              document search, helpdesk context. No other condo platform in Malaysia offers this,
              and it is built for control from day one.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <Lock className="size-4 text-[rgb(var(--sr-coral))]" />
                Encrypted credentials
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <ShieldCheck className="size-4 text-[rgb(var(--sr-coral))]" />
                Tested before enabled
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <Eye className="size-4 text-[rgb(var(--sr-coral))]" />
                Every action audited
              </span>
            </div>
          </div>
          <McpMockup />
        </div>
      </section>

      {/* Automation band */}
      <section className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-xl">
            <Badge tone="primary" className="h-7 px-3">
              <GitBranch className="size-3.5" />
              Automation you can watch
            </Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              The system does the busywork — in the open
            </h2>
            <p className="mt-2 sr-muted">
              Monthly billing, receipt PDFs, reminders, and overdue checks run on schedule and post
              to a live status board. You always see what succeeded, what is running, and what is
              coming next — nothing happens behind your back.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <CheckCircle2 className="size-4 text-[rgb(var(--sr-coral))]" />
                Run-now &amp; preview
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <Clock className="size-4 text-[rgb(var(--sr-coral))]" />
                Full run history
              </span>
            </div>
          </div>
          <PipelineMockup />
        </div>
      </section>

      {/* Money features */}
      <section className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="lg:order-2 lg:max-w-xl">
            <Badge tone="primary">Billing & payments</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              A finance stack built for JMB / MC realities
            </h2>
            <p className="mt-2 sr-muted">
              From monthly maintenance fees to sinking-fund accounting, everything is auditable,
              duplicate-safe, and easy for a non-accountant to run. Residents pay online or prepay
              in advance, and the credit offsets their next invoice automatically.
            </p>
          </div>
          <div className="lg:order-1">
            <InvoiceMockup />
          </div>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {moneyFeatures.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* Accounting band */}
      <section className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-xl">
            <Badge tone="info">Accounting &amp; reporting</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Books that stay honest, reports auditors accept
            </h2>
            <p className="mt-2 sr-muted">
              A fund-separated ledger keeps maintenance and sinking fund distinct, with collections,
              arrears aging, deposits, and unit statements at a glance — all exportable to CSV for
              AGM time and auditor follow-up.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <Landmark className="size-4 text-[rgb(var(--sr-coral))]" />
                Fund-separated
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5">
                <Download className="size-4 text-[rgb(var(--sr-coral))]" />
                CSV exports
              </span>
            </div>
          </div>
          <LedgerMockup />
        </div>
      </section>

      {/* Operations features */}
      <section className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <GateMockup />
          <div className="lg:max-w-xl">
            <Badge tone="info">Living & operations</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Everyday building life, sorted
            </h2>
            <p className="mt-2 sr-muted">
              The daily interactions between residents, guards, and management — fast, tracked, and
              friendly. Guests scan in at the gate, defects are ranked by urgency and routed to the
              right team, and owners always know who arrived and when.
            </p>
          </div>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {operationFeatures.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="container-page">
        <div className="rounded-3xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] p-8">
          <div className="mb-8 flex items-center gap-3">
            <ShieldCheck className="size-6 text-[rgb(var(--sr-coral))]" />
            <h2 className="text-3xl font-bold tracking-tight">Transparency and trust</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {trustFeatures.map((f) => (
              <div key={f.title} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <f.icon className="size-5 text-[rgb(var(--sr-coral))]" />
                  <h3 className="font-semibold">{f.title}</h3>
                </div>
                <p className="text-sm leading-relaxed sr-muted">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-[rgb(var(--sr-border))] pt-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-4 text-[rgb(var(--sr-coral))]" />
              Security hardening, built in
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                'Payment credentials encrypted at rest — never shown again, never sent to the browser',
                'Online payments accepted only after the gateway is verified; mismatches held for review',
                'Permissions enforced on the server for every request, scoped to role and unit',
                'Audit logging and session controls, so access can be reviewed and revoked',
              ].map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/50 p-3 sr-muted"
                >
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[rgb(var(--sr-coral))]" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs sr-muted">
              We intentionally keep the low-level details private — this is the standard of care,
              not a map for attackers.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page">
        <div className="mb-8 max-w-2xl">
          <Badge tone="neutral">
            <Building2 className="size-3.5" />
            How it works
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">Up and running in three steps</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.step} className="h-full">
              <div className="text-4xl font-bold text-[rgb(var(--sr-coral)/0.35)]">{s.step}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed sr-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-[rgb(var(--sr-coral))] p-10 text-center text-white sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See it running in the demo condo
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Explore the resident and management portals with pre-seeded data. No setup, no
            commitment.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/sign-up">
              <Button
                size="lg"
                variant="secondary"
                className="w-full border-transparent bg-white text-[rgb(var(--sr-coral))] hover:bg-white/90 sm:w-auto"
              >
                Try the demo
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button
                size="lg"
                variant="ghost"
                className="w-full text-white hover:bg-white/15 sm:w-auto"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="container-page">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-[rgb(var(--sr-border))] pt-8 text-xs sr-muted sm:flex-row">
          <div>
            Smart<span className="text-coral-500">Residence</span> · built for residents, not
            against them.
          </div>
          <div>Licensed under AGPL-3.0.</div>
        </div>
      </footer>
    </main>
  );
}
