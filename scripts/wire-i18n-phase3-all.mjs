import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, src) {
  fs.writeFileSync(path.join(root, rel), src);
  console.log('wrote', rel);
}

function patch(rel, reps) {
  let src = read(rel);
  for (const [from, to] of reps) {
    if (!src.includes(from)) {
      console.warn(`skip: ${rel} :: ${from.slice(0, 50)}…`);
      continue;
    }
    src = src.split(from).join(to);
  }
  write(rel, src);
}

patch('apps/web/src/components/guard-shell.tsx', [
  [
    "import { api } from '@/lib/api';",
    "import { useT } from '@/i18n/locale-provider';\nimport { api } from '@/lib/api';",
  ],
  [
    `const GUARD_NAV = [
  { href: '/guard', label: 'Live', match: (p: string) => p === '/guard' },
  {
    href: '/guard/expected',
    label: 'Expected',
    match: (p: string) => p.startsWith('/guard/expected'),
  },
  {
    href: '/guard/check-in',
    label: 'Check-in',
    match: (p: string) => p.startsWith('/guard/check-in'),
  },
  {
    href: '/guard/walk-in',
    label: 'Walk-in',
    match: (p: string) => p.startsWith('/guard/walk-in'),
  },
  {
    href: '/guard/parcels',
    label: 'Parcels',
    match: (p: string) => p.startsWith('/guard/parcels'),
  },
  {
    href: '/guard/settings',
    label: 'Settings',
    match: (p: string) => p.startsWith('/guard/settings'),
  },
] as const;`,
    `const GUARD_NAV = [
  { href: '/guard', labelKey: 'nav.guard.live', match: (p: string) => p === '/guard' },
  {
    href: '/guard/expected',
    labelKey: 'nav.guard.expected',
    match: (p: string) => p.startsWith('/guard/expected'),
  },
  {
    href: '/guard/check-in',
    labelKey: 'nav.guard.checkIn',
    match: (p: string) => p.startsWith('/guard/check-in'),
  },
  {
    href: '/guard/walk-in',
    labelKey: 'nav.guard.walkIn',
    match: (p: string) => p.startsWith('/guard/walk-in'),
  },
  {
    href: '/guard/parcels',
    labelKey: 'nav.guard.parcels',
    match: (p: string) => p.startsWith('/guard/parcels'),
  },
  {
    href: '/guard/settings',
    labelKey: 'nav.guard.settings',
    match: (p: string) => p.startsWith('/guard/settings'),
  },
] as const;`,
  ],
  [
    `export function GuardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();`,
    `export function GuardShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();`,
  ],
  ['aria-label="SmartResidence Gate home"', 'aria-label={t("nav.guard.gateHome")}'],
  ['aria-label="Gate navigation"', 'aria-label={t("nav.guard.gateNav")}'],
  ['<span className="font-semibold">Gate</span>', '<span className="font-semibold">{t("nav.guard.gateBrand")}</span>'],
  ['{item.label}', '{t(item.labelKey)}'],
  [
    `<Settings2 className="size-4" />
            Settings`,
    `<Settings2 className="size-4" />
            {t('nav.guard.settings')}`,
  ],
  [
    `<LogOut className="size-4" />
            Sign out`,
    `<LogOut className="size-4" />
            {t('nav.signOut')}`,
  ],
  [
    `items={[
          { href: '/guard', label: 'Live', isActive: (p) => p === '/guard' },
          {
            href: '/guard/expected',
            label: 'Expected',
            isActive: (p) => p.startsWith('/guard/expected'),
          },
          {
            href: '/guard/check-in',
            label: 'Check-in',
            isActive: (p) => p.startsWith('/guard/check-in'),
          },
          {
            href: '/guard/walk-in',
            label: 'Walk-in',
            isActive: (p) => p.startsWith('/guard/walk-in'),
          },
          {
            href: '/guard/parcels',
            label: 'Parcels',
            isActive: (p) => p.startsWith('/guard/parcels'),
          },
        ]}`,
    `items={[
          { href: '/guard', label: t('nav.guard.live'), isActive: (p) => p === '/guard' },
          {
            href: '/guard/expected',
            label: t('nav.guard.expected'),
            isActive: (p) => p.startsWith('/guard/expected'),
          },
          {
            href: '/guard/check-in',
            label: t('nav.guard.checkIn'),
            isActive: (p) => p.startsWith('/guard/check-in'),
          },
          {
            href: '/guard/walk-in',
            label: t('nav.guard.walkIn'),
            isActive: (p) => p.startsWith('/guard/walk-in'),
          },
          {
            href: '/guard/parcels',
            label: t('nav.guard.parcels'),
            isActive: (p) => p.startsWith('/guard/parcels'),
          },
        ]}`,
  ],
]);

patch('apps/web/src/components/guard-live-visitor-detail.tsx', [
  [
    `Walk-in visit — record only. Closes automatically at end of day; no manual
                  checkout.`,
    `{t('visitors.guard.recordOnlyHint')}`,
  ],
]);

patch('apps/web/src/app/guard/walk-in/page.tsx', [
  [
    `<p className="font-semibold text-red-700">Visitor blocked</p>`,
    `<p className="font-semibold text-red-700">{t('visitors.guard.blockedTitle')}</p>`,
  ],
  ['ariaLabel="Walk-in type"', 'ariaLabel={t("visitors.guard.walkInTypeAria")}'],
]);

patch('apps/web/src/app/(auth)/sign-in/page.tsx', [
  [
    "import { toast } from '@/lib/toast';",
    "import { useT } from '@/i18n/locale-provider';\nimport { toast } from '@/lib/toast';",
  ],
  [
    `const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Required'),
  totp: z.string().optional(),
});

/** Strip sensitive query params`,
    `/** Strip sensitive query params`,
  ],
  [
    `function useSignInQueryParams(form: ReturnType<typeof useForm<z.infer<typeof schema>>>) {`,
    `function useSignInQueryParams(form: ReturnType<typeof useForm<{ email: string; password: string; totp?: string }>>) {`,
  ],
  [
    `export default function SignInPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });`,
    `export default function SignInPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const schema = React.useMemo(
    () =>
      z.object({
        email: z.string().email(),
        password: z.string().min(1, t('auth.required')),
        totp: z.string().optional(),
      }),
    [t],
  );
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });`,
  ],
  [
    `async function onSubmit(values: z.infer<typeof schema>) {`,
    `async function onSubmit(values: z.infer<typeof schema>) {`,
  ],
  ["toast.success('Signed in');", "toast.success(t('auth.signedInToast'));"],
  [
    "toast.message('Enter your 2FA code to continue');",
    "toast.message(t('auth.totpPrompt'));",
  ],
  ['<h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome back</h1>', '<h1 className="mt-6 text-2xl font-semibold tracking-tight">{t(\'auth.welcomeBack\')}</h1>'],
  [
    `Sign in to manage visitors, fees, and defects for your unit.`,
    `{t('auth.signInBlurb')}`,
  ],
  ['<Label htmlFor="email">Email</Label>', '<Label htmlFor="email">{t(\'auth.email\')}</Label>'],
  ['<Label htmlFor="password">Password</Label>', '<Label htmlFor="password">{t(\'auth.password\')}</Label>'],
  ['<Label htmlFor="totp">2FA code</Label>', '<Label htmlFor="totp">{t(\'auth.totp\')}</Label>'],
  [
    `<Button type="submit" loading={form.formState.isSubmitting} className="mt-2">
            Sign in
          </Button>`,
    `<Button type="submit" loading={form.formState.isSubmitting} className="mt-2">
            {t('auth.signIn')}
          </Button>`,
  ],
  ["New here?{' '}", "{t('auth.newHere')}{' '}"],
  [`Create an account`, `{t('auth.signUp')}`],
  [
    `Demo: <code>owner@acacia.demo</code> / <code>Demo!2026</code>`,
    `{t('auth.demoHint', { email: 'owner@acacia.demo', password: 'Demo!2026' })}`,
  ],
]);

patch('apps/web/src/app/(auth)/sign-up/page.tsx', [
  [
    "import { toast } from '@/lib/toast';",
    "import { useT } from '@/i18n/locale-provider';\nimport { toast } from '@/lib/toast';",
  ],
  [
    `const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: MalaysiaPhoneSchema,
  password: z
    .string()
    .min(10, 'At least 10 characters')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/\\d/, 'Add a digit'),
});

export default function SignUpPage() {
  const router = useRouter();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });`,
    `export default function SignUpPage() {
  const t = useT();
  const router = useRouter();
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: MalaysiaPhoneSchema,
    password: z
      .string()
      .min(10, t('auth.passwordMinLength'))
      .regex(/[A-Z]/, t('auth.passwordUppercase'))
      .regex(/[a-z]/, t('auth.passwordLowercase'))
      .regex(/\\d/, t('auth.passwordDigit')),
  });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });`,
  ],
  ["toast.success('Welcome');", "toast.success(t('auth.welcomeToast'));"],
  [
    '<h1 className="mt-6 text-2xl font-semibold tracking-tight">Create your account</h1>',
    '<h1 className="mt-6 text-2xl font-semibold tracking-tight">{t(\'auth.createAccountTitle\')}</h1>',
  ],
  [
    `Your management office will link this account to your unit.`,
    `{t('auth.signUpBlurb')}`,
  ],
  ['<Label htmlFor="name">Full name</Label>', '<Label htmlFor="name">{t(\'auth.fullName\')}</Label>'],
  ['<Label htmlFor="email">Email</Label>', '<Label htmlFor="email">{t(\'auth.email\')}</Label>'],
  ['<Label htmlFor="phone">Mobile phone</Label>', '<Label htmlFor="phone">{t(\'auth.mobilePhone\')}</Label>'],
  [
    `Malaysia mobile — guards may call you for walk-in approvals.`,
    `{t('auth.phoneHint')}`,
  ],
  ['<Label htmlFor="password">Password</Label>', '<Label htmlFor="password">{t(\'auth.password\')}</Label>'],
  [
    `<p className="text-xs sr-muted">10+ chars, mix of upper/lower/digit.</p>`,
    `<p className="text-xs sr-muted">{t('auth.passwordHint')}</p>`,
  ],
  [
    `<Button type="submit" loading={form.formState.isSubmitting} className="mt-2">
            Create account
          </Button>`,
    `<Button type="submit" loading={form.formState.isSubmitting} className="mt-2">
            {t('auth.signUp')}
          </Button>`,
  ],
  ["Already have an account?{' '}", "{t('auth.alreadyHaveAccount')}{' '}"],
  [
    `<Link href="/sign-in" className="text-coral-500 hover:underline">
            Sign in
          </Link>`,
    `<Link href="/sign-in" className="text-coral-500 hover:underline">
            {t('auth.signIn')}
          </Link>`,
  ],
]);

write(
  'apps/web/src/app/guard/check-in/page.tsx',
  read('apps/web/src/app/guard/check-in/page.tsx')
    .replace(
      "import { api } from '@/lib/api';",
      "import { useT } from '@/i18n/locale-provider';\nimport { api } from '@/lib/api';",
    )
    .replace(
      `function unitLabel(v: VerifiedPass) {
  if ('passType' in v && v.passType === 'recurring') {
    return v.unitLabel ?? '—';
  }
  const visitor = v as VerifiedVisitor;
  const block = visitor.unit?.block?.name;
  const unit = visitor.unit?.identifier;
  if (block && unit) return \`\${block} · \${unit}\`;
  return unit ?? (visitor.visitType === 'WALKIN_OFFICE' ? 'Management office' : '—');
}`,
      `function unitLabel(v: VerifiedPass, t: ReturnType<typeof useT>) {
  if ('passType' in v && v.passType === 'recurring') {
    return v.unitLabel ?? '—';
  }
  const visitor = v as VerifiedVisitor;
  const block = visitor.unit?.block?.name;
  const unit = visitor.unit?.identifier;
  if (block && unit) return \`\${block} · \${unit}\`;
  if (unit) return unit;
  if (visitor.visitType === 'WALKIN_OFFICE') return t('visitors.guard.managementOffice');
  return '—';
}`,
    )
    .replace(
      `export default function GuardCheckInPage() {
  const [code, setCode] = useState('');`,
      `export default function GuardCheckInPage() {
  const t = useT();
  const [code, setCode] = useState('');`,
    )
    .replace(
      `toast.error(pass.scheduleMessage ?? 'Outside recurring pass schedule');`,
      `toast.error(pass.scheduleMessage ?? t('visitors.guard.outsideSchedule'));`,
    )
    .replace(
      `toast.success(\`\${displayName(pass)} checked in\`);`,
      `toast.success(t('visitors.guard.checkedInToast', { name: displayName(pass) }));`,
    )
    .replace(
      `<h1 className="text-2xl font-bold tracking-tight">Check in visitor</h1>
        <p className="sr-muted text-sm mt-1">
          Enter the visitor&apos;s access code or scan their QR code (one-off visit or weekly pass).
        </p>`,
      `<h1 className="text-2xl font-bold tracking-tight">{t('visitors.guard.checkInTitle')}</h1>
        <p className="sr-muted text-sm mt-1">{t('visitors.guard.checkInBlurb')}</p>`,
    )
    .replace(
      `<p className="font-semibold text-red-700">Visitor blocked</p>`,
      `<p className="font-semibold text-red-700">{t('visitors.guard.blockedTitle')}</p>`,
    )
    .replace(`<Label htmlFor="pass">Access code / QR</Label>`, `<Label htmlFor="pass">{t('visitors.guard.accessCodeLabel')}</Label>`)
    .replace(`placeholder="e.g. K7M3P9"`, `placeholder={t('visitors.guard.accessCodePlaceholder')}`)
    .replace(
      `{busy && !pass ? 'Looking up…' : 'Look up pass'}`,
      `{busy && !pass ? t('visitors.guard.lookingUp') : t('visitors.guard.lookUpPass')}`,
    )
    .replace(
      `<p className="text-sm sr-muted">Unit: {unitLabel(pass)}</p>`,
      `<p className="text-sm sr-muted">{t('visitors.guard.unitPrefix', { unit: unitLabel(pass, t) })}</p>`,
    )
    .replace(
      `Recurring pass · {pass.scheduleMessage ?? 'Within schedule'}`,
      `{t('visitors.guard.recurringPassMeta', { message: pass.scheduleMessage ?? t('visitors.guard.withinSchedule') })}`,
    )
    .replace(
      `{(pass as VerifiedVisitor).entryMode === 'DRIVE_IN' ? 'Drive in' : 'Walk in'}`,
      `{(pass as VerifiedVisitor).entryMode === 'DRIVE_IN' ? t('visitors.guard.driveIn') : t('visitors.guard.walkInEntry')}`,
    )
    .replace(`Allow entry`, `{t('visitors.guard.allowEntry')}`),
);

patch('apps/mobile/src/providers.tsx', [
  [
    "import { PushNavigationBridge } from './push-navigation-bridge';",
    "import { LocaleProvider } from './i18n/locale-provider';\nimport { PushNavigationBridge } from './push-navigation-bridge';",
  ],
  [
    `<QueryClientProvider client={client}>
          <MobileRealtimeProvider>`,
    `<QueryClientProvider client={client}>
          <LocaleProvider>
          <MobileRealtimeProvider>`,
  ],
  [
    `</MobileRealtimeProvider>
        </QueryClientProvider>`,
    `</MobileRealtimeProvider>
          </LocaleProvider>
        </QueryClientProvider>`,
  ],
]);

patch('apps/mobile/app/(guard)/walkin.tsx', [
  [
    "import { api } from '../../src/lib/api';",
    "import { useT } from '../../src/i18n/locale-provider';\nimport { api } from '../../src/lib/api';",
  ],
  [
    `export default function WalkInScreen() {`,
    `export default function WalkInScreen() {
  const t = useT();`,
  ],
  [
    `eyebrow="Guard walk-in"
      title="Register walk-in visitor"
      subtitle="Use this for guests already at the guardhouse. Owner approval is requested when the condo policy requires it."`,
    `eyebrow={t('mobile.guard.walkin.eyebrow')}
      title={t('mobile.guard.walkin.title')}
      subtitle={t('mobile.guard.walkin.subtitle')}`,
  ],
]);

// Mobile expected
patch('apps/mobile/app/(guard)/expected.tsx', [
  [
    "import { api } from '../../src/lib/api';",
    "import { useT } from '../../src/i18n/locale-provider';\nimport { api } from '../../src/lib/api';",
  ],
  [
    `const TAB_LABELS: Record<ExpectedTab, string> = {
  expected: 'Expected',
  no_show: 'No-shows',
  history: 'History',
};`,
    `function tabLabels(t: ReturnType<typeof useT>): Record<ExpectedTab, string> {
  return {
    expected: t('visitors.guard.tabs.expected'),
    no_show: t('visitors.guard.tabs.noShow'),
    history: t('visitors.guard.tabs.history'),
  };
}`,
  ],
  [
    `function visitDateLabel(date: Date): string {
  return isToday(date) ? 'Today' : SHORT_DATE_FORMATTER.format(date);
}`,
    `function visitDateLabel(date: Date, t: ReturnType<typeof useT>): string {
  return isToday(date) ? t('visitors.guard.tabs.today') : SHORT_DATE_FORMATTER.format(date);
}`,
  ],
  [
    `function visitMetaPrefix(variant: ExpectedTab): string {
  switch (variant) {
    case 'expected':
      return 'Due';
    case 'no_show':
      return 'Missed';
    case 'history':
      return 'Visited';
  }
}`,
    `function visitMetaPrefix(variant: ExpectedTab, t: ReturnType<typeof useT>): string {
  switch (variant) {
    case 'expected':
      return t('visitors.guard.statusApproved');
    case 'no_show':
      return t('visitors.guard.noShowBadge');
    case 'history':
      return t('visitors.guard.tabs.history');
  }
}`,
  ],
  [
    `function visitTypeLabel(visitType: string): string {
  switch (visitType) {
    case 'PRE_REG':
      return 'Pre-registered';
    case 'WALKIN_UNIT':
      return 'Walk-in';
    case 'WALKIN_OFFICE':
      return 'Management office';
    default:
      return plainLabel(visitType);
  }
}`,
    `function visitTypeLabel(visitType: string, t: ReturnType<typeof useT>): string {
  switch (visitType) {
    case 'PRE_REG':
      return t('visitors.guard.visitTypePreReg');
    case 'WALKIN_UNIT':
      return t('visitors.guard.visitTypeWalkInUnit');
    case 'WALKIN_OFFICE':
      return t('visitors.guard.visitTypeWalkInOffice');
    default:
      return plainLabel(visitType);
  }
}`,
  ],
  [
    `function arrivalLabel(highlight: 'soon' | 'overdue' | null, expectedAt: Date): string | null {
  if (!highlight) return null;
  if (highlight === 'overdue') return 'Overdue';
  const minutes = Math.max(0, Math.round((expectedAt.getTime() - Date.now()) / 60_000));
  return minutes <= 1 ? 'Arriving soon' : \`Arriving in \${minutes}m\`;
}`,
    `function arrivalLabel(
  highlight: 'soon' | 'overdue' | null,
  expectedAt: Date,
  t: ReturnType<typeof useT>,
): string | null {
  if (!highlight) return null;
  if (highlight === 'overdue') return t('visitors.guard.overdue');
  const minutes = Math.max(0, Math.round((expectedAt.getTime() - Date.now()) / 60_000));
  return minutes <= 1
    ? t('visitors.guard.arrivingSoon')
    : t('visitors.guard.arrivingIn', { minutes });
}`,
  ],
  [
    `function ExpectedVisitorCard({`,
    `function ExpectedVisitorCard({
  t,`,
  ],
  [
    `}: {
  visitor: GuardExpectedVisitor;
  variant: ExpectedTab;
  onAcknowledgeWalkIn?: (visitorId: string, name: string) => void;
  acknowledging?: boolean;
}) {`,
    `}: {
  t: ReturnType<typeof useT>;
  visitor: GuardExpectedVisitor;
  variant: ExpectedTab;
  onAcknowledgeWalkIn?: (visitorId: string, name: string) => void;
  acknowledging?: boolean;
}) {`,
  ],
  ['visitDateLabel(expectedAt)', 'visitDateLabel(expectedAt, t)'],
  ['visitMetaPrefix(variant)', 'visitMetaPrefix(variant, t)'],
  ['visitTypeLabel(visitor.visitType)', 'visitTypeLabel(visitor.visitType, t)'],
  ['arrivalLabel(highlight, expectedAt)', 'arrivalLabel(highlight, expectedAt, t)'],
]);

let expected = read('apps/mobile/app/(guard)/expected.tsx');
if (!expected.includes('const TAB_LABELS = tabLabels(t)')) {
  expected = expected.replace(
    `export default function ExpectedScreen() {`,
    `export default function ExpectedScreen() {
  const t = useT();
  const TAB_LABELS = tabLabels(t);`,
  );
}
expected = expected.replace(
  `<ExpectedVisitorCard
          visitor={item}`,
  `<ExpectedVisitorCard
          t={t}
          visitor={item}`,
);
expected = expected.replace(`eyebrow="Guard arrivals"`, `eyebrow={t('mobile.guard.expected.eyebrow')}`);
expected = expected.replace(`title="Expected visitors"`, `title={t('visitors.guard.expectedTitle')}`);
expected = expected.replace(
  `subtitle="Review approved visitors, missed arrivals, and recent guardhouse history."`,
  `subtitle={t('mobile.guard.expected.subtitle')}`,
);
expected = expected.replace(
  `Alert.alert('Acknowledged', \`\${name} recorded on site.\`)`,
  `Alert.alert(t('mobile.guard.expected.acknowledgedTitle'), t('mobile.guard.expected.acknowledgedMessage', { name }))`,
);
expected = expected.replace(
  `(err: Error) => Alert.alert('Could not acknowledge', err.message)`,
  `(err: Error) => Alert.alert(t('mobile.guard.expected.ackFailedTitle'), err.message)`,
);
expected = expected.replace(`title="No visitors expected"`, `title={t('visitors.guard.emptyExpected')}`);
expected = expected.replace(
  `description="Pre-registered visitors due today will appear here."`,
  `description={t('visitors.guard.emptyExpectedHint')}`,
);
expected = expected.replace(`title="No no-shows today"`, `title={t('visitors.guard.emptyNoShow')}`);
expected = expected.replace(
  `description="Visitors who missed their arrival window will appear here."`,
  `description={t('visitors.guard.emptyNoShowHint')}`,
);
expected = expected.replace(`title="No history yet"`, `title={t('visitors.guard.emptyHistory')}`);
write('apps/mobile/app/(guard)/expected.tsx', expected);

console.log('done');
