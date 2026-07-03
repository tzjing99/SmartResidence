import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function patch(file, reps) {
  const fp = path.join(root, file);
  let src = fs.readFileSync(fp, 'utf8');
  if (!src.includes('useT()')) {
    src = src.replace(
      "import { api } from '../../src/lib/api';",
      "import { useT } from '../../src/i18n/locale-provider';\nimport { api } from '../../src/lib/api';",
    );
    src = src.replace(/export default function (\w+)\(\) \{\n/, (m) => `${m}  const t = useT();\n`);
  }
  for (const [from, to] of reps) {
    if (src.includes(from)) src = src.split(from).join(to);
  }
  fs.writeFileSync(fp, src);
  console.log('patched', file);
}

patch('apps/mobile/app/(guard)/live.tsx', [
  ["return 'Just in'", "return t('mobile.guard.live.justIn')"],
  ["return 'Pre-reg'", "return t('visitors.guard.visitTypePreReg')"],
  ["return 'Walk-in'", "return t('visitors.guard.visitTypeWalkInUnit')"],
  ["return 'Office'", "return t('visitors.guard.visitTypeWalkInOffice')"],
  [
    "function formatTimeOnSite(checkedInAt: Date, now = new Date()): string {",
    "function formatTimeOnSite(checkedInAt: Date, t: ReturnType<typeof useT>, now = new Date()): string {",
  ],
  [
    "function visitTypeLabel(visitType: string): string {",
    "function visitTypeLabel(visitType: string, t: ReturnType<typeof useT>): string {",
  ],
  ["formatTimeOnSite(checkedInAt)", "formatTimeOnSite(checkedInAt, t)"],
  ["visitTypeLabel(v.visitType)", "visitTypeLabel(v.visitType, t)"],
  [
    "Alert.alert('Check out visitor?', 'Are you sure? They will leave the live board.', [",
    "Alert.alert(t('mobile.guard.live.checkOutTitle'), t('mobile.guard.live.checkOutBody'), [",
  ],
  ["{ text: 'Cancel', style: 'cancel' }", "{ text: t('actions.cancel'), style: 'cancel' }"],
  ["text: 'Yes, check out'", "text: t('mobile.guard.live.checkOutYes')"],
  [
    "() => Alert.alert('Checked out', `${name} has left the premises.`)",
    "() => Alert.alert(t('mobile.guard.live.checkedOutTitle'), t('mobile.guard.live.checkedOutMessage', { name }))",
  ],
  [
    "(err: Error) => Alert.alert('Could not check out', err.message)",
    "(err: Error) => Alert.alert(t('mobile.guard.live.checkOutFailedTitle'), err.message)",
  ],
  [
    "{v.unitLabel ?? 'Unit not shown'} · on site",
    "{v.unitLabel ?? t('mobile.guard.live.unitNotShown')} · {t('mobile.guard.live.onSiteMeta')}",
  ],
  ['title="Check out"', 'title={t("visitors.guard.checkOut")}'],
  ['eyebrow="Guard live board"', 'eyebrow={t("mobile.guard.live.eyebrow")}'],
  ['title="On site now"', 'title={t("visitors.guard.liveTitle")}'],
  ['title="No visitors on site"', 'title={t("visitors.guard.liveEmpty")}'],
  ["[checkOut]", "[checkOut, t]"],
  ["[callPhone, checkOut.isPending, confirmCheckOut, twoColumn]", "[callPhone, checkOut.isPending, confirmCheckOut, twoColumn, t]"],
]);

patch('apps/mobile/app/(guard)/scan.tsx', [
  [
    "Alert.alert('Welcome', `${v.name} checked in.`)",
    "Alert.alert(t('mobile.guard.scan.welcomeCheckedIn'), t('mobile.guard.scan.checkedInMessage', { name: v.name }))",
  ],
  ["Alert.alert('Visitor blocked', message)", "Alert.alert(t('visitors.guard.blockedTitle'), message)"],
  [
    "Alert.alert('Queued', 'Network unavailable — check-in will sync automatically.')",
    "Alert.alert(t('mobile.guard.scan.queuedTitle'), t('mobile.guard.scan.queuedMessage'))",
  ],
  ['Guard scan', "{t('mobile.guard.scan.title')}"],
  [
    'Verify visitor passes at the gate when you are ready to use the camera.',
    "{t('mobile.guard.scan.subtitle')}",
  ],
  [
    "label={pending > 0 ? `${pending} queued` : 'online'}",
    "label={pending > 0 ? t('mobile.guard.scan.queued', { count: pending }) : t('mobile.guard.scan.online')}",
  ],
]);
