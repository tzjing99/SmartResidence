import { Badge, Button, Card } from '@smartresidence/ui-web';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  BrainCircuit,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Eye,
  Fingerprint,
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
  Sparkles,
  Timer,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';

type Detail = { label: string; body: string };

type FeatureSection = {
  id: string;
  eyebrow: string;
  icon: typeof Receipt;
  title: string;
  intro: string;
  details: Detail[];
};

const sections: FeatureSection[] = [
  {
    id: 'mcp',
    eyebrow: 'AI tool connections (MCP)',
    icon: Plug,
    title: 'Connect AI assistants to your building — a Malaysian condo-software first',
    intro:
      'SmartResidence speaks the open Model Context Protocol (MCP), the same standard modern AI assistants use to reach real tools. Management can connect approved AI helpers directly to the building\u2019s data — with control, encryption, and an audit trail built in. No other condo platform in Malaysia offers this.',
    details: [
      {
        label: 'Bring your own AI tools',
        body: 'Connect vetted MCP servers — billing lookups, visitor logs, document search, helpdesk context — so assistants work with your real building data instead of guessing.',
      },
      {
        label: 'Open standard, no lock-in',
        body: 'MCP is an open protocol supported across the AI ecosystem. Point SmartResidence at any compatible server, self-hosted or vendor-provided.',
      },
      {
        label: 'Encrypted, write-only credentials',
        body: 'Bearer tokens and API keys are encrypted at rest and never returned to the browser — the same protection used for payment gateway secrets.',
      },
      {
        label: 'Tested before it goes live',
        body: 'Every connection must pass a live handshake (initialize + tool discovery) before management can enable it, so broken or fake servers never get switched on.',
      },
      {
        label: 'Management in control, fully audited',
        body: 'Only management can add, test, enable, or remove connections, and every change is written to the audit log.',
      },
    ],
  },
  {
    id: 'gate',
    eyebrow: 'Smart Residence Gate',
    icon: ScanLine,
    title: 'A smart gate that actually knows who is arriving',
    intro:
      'Turn the guardhouse into a connected checkpoint. Residents invite guests, the gate scans a pass, and owners get a transparent record of every arrival.',
    details: [
      {
        label: 'QR visitor passes',
        body: 'Residents pre-register guests and share a QR access code. Guards scan it at the gate to check the visitor in and out instantly.',
      },
      {
        label: 'Walk-in handling',
        body: 'Guards can admit unexpected walk-ins on the spot, with the unit owner notified for transparency and an approval trail.',
      },
      {
        label: 'Owner approval flow',
        body: 'Visitors that need sign-off go to the resident for approve/reject before the gate lets them through.',
      },
      {
        label: 'Overnight & vehicle rules',
        body: 'Overnight-stay policies, vehicle plate capture, and per-unit suspension keep the gate aligned with house rules.',
      },
      {
        label: 'Live gate board',
        body: 'A real-time board shows who is currently on-site, expected arrivals, and full visit history for auditing.',
      },
    ],
  },
  {
    id: 'ml',
    eyebrow: 'Learns from you',
    icon: BrainCircuit,
    title: 'A system that learns how your building really runs',
    intro:
      'SmartResidence studies the requests your team has already resolved and uses that to prioritize and route new ones — the more you use it, the smarter it gets.',
    details: [
      {
        label: 'Ranks requests by urgency',
        body: 'When a resident raises an issue, the system suggests how urgent it likely is based on similar past requests, so nothing important slips through.',
      },
      {
        label: 'Learns from your own history',
        body: 'It only starts making suggestions once your team has resolved enough cases, and it learns from your building\u2019s own records — kept private to you.',
      },
      {
        label: 'Sends work to the right team',
        body: 'Management can set who handles what, so incoming issues are automatically pointed to the correct person or team.',
      },
      {
        label: 'Safe, sensible defaults',
        body: 'Clear rules always provide a reliable baseline, and the learning only fine-tunes priority when it is confident.',
      },
    ],
  },
  {
    id: 'billing',
    eyebrow: 'Billing & payments',
    icon: Receipt,
    title: 'A finance engine built for Malaysian JMB / MC realities',
    intro:
      'Maintenance fees, sinking fund, deposits, and online collection — auditable, duplicate-safe, and understandable by a non-accountant.',
    details: [
      {
        label: 'Invoices with real receipts',
        body: 'Each line item shows its formula and issues an official receipt PDF, with gap-free, race-safe numbering per condo.',
      },
      {
        label: 'Automatic billing cycles',
        body: 'Generate invoices from each unit type\u2019s fee schedule on a chosen day, with preview, run-now, and a status view that shows what ran and what is next.',
      },
      {
        label: 'Dynamic fee schedule',
        body: 'Add real-life charges like fire insurance, quit rent, assessment, or a special levy for a specific month or recurring.',
      },
      {
        label: 'Advance maintenance credit',
        body: 'Residents prepay a fixed or custom amount via gateway; confirmed payments become prepaid credit that offsets the next invoice.',
      },
      {
        label: 'Secure gateway payments',
        body: 'Fiuu, iPay88, and Stripe (covering FPX, e-wallet, and card) with signed callbacks, amount-mismatch review, and encrypted per-condo credentials.',
      },
      {
        label: 'Deposits done properly',
        body: 'Track renovation and access-card deposits across every unit, with partial refunds, forfeitures, and held-liability totals.',
      },
    ],
  },
  {
    id: 'accounting',
    eyebrow: 'Accounting & reporting',
    icon: Landmark,
    title: 'Books that stay honest, and reports auditors accept',
    intro:
      'A fund-separated ledger keeps maintenance and sinking fund distinct, with the reports management needs at AGM time.',
    details: [
      {
        label: 'Fund-separated ledger',
        body: 'Every charge, payment, deposit, and reversal is recorded and tagged by fund for accurate statutory reporting.',
      },
      {
        label: 'Collections & arrears',
        body: 'Date-range collections, arrears aging buckets, and units-in-arrears at a glance, with drill-down and CSV export.',
      },
      {
        label: 'Receipt register',
        body: 'A searchable trail of payment, deposit, and refund receipts for resident queries and auditor follow-up.',
      },
      {
        label: 'Unit statements',
        body: 'Per-unit running balances showing charges, payments, and prepaid credit, exportable for disputes.',
      },
    ],
  },
  {
    id: 'automation',
    eyebrow: 'Automation',
    icon: GitBranch,
    title: 'Automation you can actually see',
    intro:
      'The system can handle repetitive work for you — but you stay in control. A simple status board shows what it did and what is coming up next.',
    details: [
      {
        label: 'Clear status board',
        body: 'Monthly billing, overdue checks, and reminders each show whether they succeeded, are running, or are scheduled next.',
      },
      {
        label: 'Never double-charges',
        body: 'Automatic runs skip anything already billed and any unit without a fee set, so re-running is always safe.',
      },
      {
        label: 'Full run history',
        body: 'Each run records how many invoices were created or skipped and any problems, so nothing happens silently.',
      },
    ],
  },
  {
    id: 'operations',
    eyebrow: 'Living & operations',
    icon: Wrench,
    title: 'Everyday building life, tracked end to end',
    intro:
      'The daily interactions between residents, guards, and management — fast, friendly, and never lost in email.',
    details: [
      {
        label: 'Defects that get fixed',
        body: 'Photo, location, a status timeline, and a chat thread with management, from report to resolution.',
      },
      {
        label: 'Handover inspections',
        body: 'Structured space / element / issue taxonomy and handover reports with resident sign-off.',
      },
      {
        label: 'Helpdesk with SLA',
        body: 'Resident-driven tickets with SLA timers, internal notes, escalation, and resident confirmation before closing.',
      },
      {
        label: 'Targeted announcements',
        body: 'Notify the whole condo, selected blocks, or named units, with read tracking and acknowledgements.',
      },
    ],
  },
  {
    id: 'dashboards',
    eyebrow: 'Dashboards',
    icon: LayoutDashboard,
    title: 'Purpose-built home screens for each role',
    intro:
      'Residents and management get different dashboards, because they have completely different jobs to do.',
    details: [
      {
        label: 'Management command center',
        body: 'A prioritized to-do list plus finance health, today\u2019s operations, invoice automation status, and announcements.',
      },
      {
        label: 'Resident next-action home',
        body: 'One clear next step — pay overdue, confirm a pending payment, acknowledge a notice, or greet the next visitor.',
      },
      {
        label: 'Multi-unit aware',
        body: 'Owners with more than one unit can switch context without losing their place.',
      },
    ],
  },
  {
    id: 'trust',
    eyebrow: 'Transparency & security',
    icon: ShieldCheck,
    title: 'Built so residents can trust it',
    intro:
      'Owner-empowerment is a first-class feature, not an afterthought. Residents can see and control their own data.',
    details: [
      {
        label: 'Who viewed me',
        body: 'When management opens a resident record it is audited, and the resident is notified in real time.',
      },
      {
        label: 'Role-scoped access',
        body: 'Super admin, management, staff, guard, owner, tenant, and household roles are enforced on the server.',
      },
      {
        label: 'Full audit trail',
        body: 'Every money movement and record change is logged with actor, role, and timestamp.',
      },
      {
        label: 'Own your data',
        body: 'Open-source and self-hostable, with encrypted gateway secrets and per-condo isolation.',
      },
    ],
  },
];

const highlights = [
  { icon: Plug, label: 'AI tool connections (MCP)' },
  { icon: ScanLine, label: 'Smart Residence Gate' },
  { icon: BrainCircuit, label: 'Smart request prioritization' },
  { icon: CreditCard, label: '4 payment methods' },
  { icon: Landmark, label: 'Clear fund accounting' },
  { icon: GitBranch, label: 'Automation you can see' },
  { icon: Eye, label: 'Who viewed me' },
];

const iconForDetail: Record<string, typeof Receipt> = {
  gate: QrCode,
  ml: Fingerprint,
  billing: Wallet,
  accounting: ClipboardList,
  automation: CalendarClock,
  operations: MessagesSquare,
  dashboards: LayoutDashboard,
  trust: Lock,
};

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[rgb(var(--sr-bg))]">
      <div className="container-page">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Smart<span className="text-coral-500">Residence</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="size-4" />
                Home
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button>
                Try the demo
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
          className="pointer-events-none absolute inset-x-0 -top-28 mx-auto h-72 max-w-4xl rounded-full bg-[rgb(var(--sr-coral)/0.16)] blur-3xl"
        />
        <div className="container-page relative text-center">
          <Badge tone="primary" className="h-7 px-3">
            <Sparkles className="size-3.5" />
            Everything SmartResidence can do
          </Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            One platform for the entire
            <br />
            <span className="text-coral-500">condo experience.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg sr-muted">
            From a smart gate and requests that sort themselves by urgency to airtight billing and
            real resident transparency — here is the full picture, in detail.
          </p>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
            {highlights.map((h) => (
              <span
                key={h.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-1.5 text-sm"
              >
                <h.icon className="size-4 text-[rgb(var(--sr-coral))]" />
                {h.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <section className="container-page">
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] px-3 py-1.5 text-sm sr-muted transition-colors hover:border-[rgb(var(--sr-coral)/0.4)] hover:text-[rgb(var(--sr-fg))]"
            >
              <s.icon className="size-4" />
              {s.eyebrow}
            </a>
          ))}
        </div>
      </section>

      {/* Detailed sections */}
      {sections.map((section, index) => {
        const DetailIcon = iconForDetail[section.id] ?? section.icon;
        return (
          <section key={section.id} id={section.id} className="container-page scroll-mt-24">
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div className="lg:sticky lg:top-10">
                <Badge tone={index % 2 === 0 ? 'primary' : 'info'}>{section.eyebrow}</Badge>
                <div className="mt-4 flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
                    <section.icon className="size-6" />
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{section.title}</h2>
                </div>
                <p className="mt-4 max-w-md sr-muted">{section.intro}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {section.details.map((d) => (
                  <Card key={d.label} className="h-full transition-shadow hover:shadow-lg">
                    <span className="grid size-9 place-items-center rounded-xl bg-[rgb(var(--sr-bg))] text-[rgb(var(--sr-coral))]">
                      <DetailIcon className="size-4" />
                    </span>
                    <h3 className="mt-3 font-semibold">{d.label}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed sr-muted">{d.body}</p>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Security */}
      <section className="container-page">
        <div className="rounded-3xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] p-8 sm:p-10">
          <div className="mb-8 max-w-2xl">
            <Badge tone="neutral">
              <ShieldCheck className="size-3.5" />
              Security & data protection
            </Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Hardened where it matters most
            </h2>
            <p className="mt-2 sr-muted">
              Money and personal data get serious protection. Here is the level of care we take —
              without exposing anything that would help an attacker.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Lock,
                title: 'Encrypted payment credentials',
                body: 'Gateway keys are encrypted at rest, never shown again after saving, and never sent to the browser.',
              },
              {
                icon: ShieldCheck,
                title: 'Verified payments only',
                body: 'Online payments are accepted only after the gateway is cryptographically verified, and mismatched amounts are held for review instead of auto-approved.',
              },
              {
                icon: Fingerprint,
                title: 'Permissions enforced server-side',
                body: 'Access is checked on the server for every request, not just hidden in the interface, and scoped tightly to each role and unit.',
              },
              {
                icon: Eye,
                title: 'Complete audit trail',
                body: 'Sensitive views and every money movement are logged with who, what, and when — visible to residents where it concerns them.',
              },
              {
                icon: Timer,
                title: 'Session & access control',
                body: 'Residents and staff can review active sessions and revoke access, and delegated access can be pulled back instantly.',
              },
              {
                icon: Building2,
                title: 'Isolated & self-hostable',
                body: 'Each condo\u2019s data is isolated, and the whole platform can be self-hosted so you stay in control of where it lives.',
              },
            ].map((f) => (
              <div key={f.title} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <f.icon className="size-5 text-[rgb(var(--sr-coral))]" />
                  <h3 className="font-semibold">{f.title}</h3>
                </div>
                <p className="text-sm leading-relaxed sr-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metric band */}
      <section className="container-page">
        <div className="grid grid-cols-2 gap-6 rounded-3xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] p-8 md:grid-cols-4">
          <div className="text-center">
            <Timer className="mx-auto size-6 text-[rgb(var(--sr-coral))]" />
            <div className="mt-2 text-2xl font-bold">SLA-tracked</div>
            <div className="text-xs sr-muted">Helpdesk with escalation</div>
          </div>
          <div className="text-center">
            <QrCode className="mx-auto size-6 text-[rgb(var(--sr-coral))]" />
            <div className="mt-2 text-2xl font-bold">QR gate</div>
            <div className="text-xs sr-muted">Scan-in visitor passes</div>
          </div>
          <div className="text-center">
            <BrainCircuit className="mx-auto size-6 text-[rgb(var(--sr-coral))]" />
            <div className="mt-2 text-2xl font-bold">Learns from you</div>
            <div className="text-xs sr-muted">Smarter with every request</div>
          </div>
          <div className="text-center">
            <BellRing className="mx-auto size-6 text-[rgb(var(--sr-coral))]" />
            <div className="mt-2 text-2xl font-bold">Real-time</div>
            <div className="text-xs sr-muted">Live notifications</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-[rgb(var(--sr-coral))] p-10 text-center text-white sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Explore every feature in the live demo
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Sign in to the demo condo and try the gate, billing, dashboards, and more with
            pre-seeded data.
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
            <Link href="/">
              <Button
                size="lg"
                variant="ghost"
                className="w-full text-white hover:bg-white/15 sm:w-auto"
              >
                Back to home
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
