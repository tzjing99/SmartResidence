import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function writeJson(rel, data) {
  const fp = path.join(root, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`);
}

function countKeys(obj) {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') n++;
    else if (v && typeof v === 'object') n += countKeys(v);
  }
  return n;
}

function patchEn(data) {
  Object.assign(data.actions, {
    checkIn: 'Check in',
    close: 'Close',
    confirm: 'Confirm',
    save: 'Save',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
  });
  data.nav.guard = {
    live: 'Live',
    expected: 'Expected',
    checkIn: 'Check-in',
    walkIn: 'Walk-in',
    parcels: 'Parcels',
    settings: 'Settings',
    gateHome: 'SmartResidence Gate home',
    gateNav: 'Gate navigation',
    gateBrand: 'Gate',
  };
  data.errors = {
    generic: 'Something went wrong. Please try again.',
    emptyTitle: 'Nothing here yet',
    emptyHint: 'Check back later or adjust your filters.',
  };
  Object.assign(data.auth, {
    signInSubtitle: 'Welcome back. Sign in to continue.',
    email: 'Email',
    password: 'Password',
    totp: '2FA code',
    fullName: 'Full name',
    mobilePhone: 'Mobile phone',
    phoneHint: 'Malaysia mobile — guards may call you for walk-in approvals.',
    passwordHint: '10+ chars, mix of upper/lower/digit.',
    createAccountTitle: 'Create your account',
    signUpBlurb: 'Your management office will link this account to your unit.',
    newHere: 'New here?',
    alreadyHaveAccount: 'Already have an account?',
    signedInToast: 'Signed in',
    welcomeToast: 'Welcome',
    totpPrompt: 'Enter your 2FA code to continue',
    required: 'Required',
    passwordMinLength: 'At least 10 characters',
    passwordUppercase: 'Add an uppercase letter',
    passwordLowercase: 'Add a lowercase letter',
    passwordDigit: 'Add a digit',
    demoHint: 'Demo: {email} / {password}',
    signInFailed: 'Sign in failed',
    signingIn: 'Signing in…',
    faceIdPrompt: 'Confirm to enable Face ID for SmartResidence',
    demoAccounts: 'Demo accounts · password {password}',
  });
  Object.assign(data.visitors.guard, {
    checkInTitle: 'Check in visitor',
    checkInBlurb:
      "Enter the visitor's access code or scan their QR code (one-off visit or weekly pass).",
    blockedTitle: 'Visitor blocked',
    accessCodeLabel: 'Access code / QR',
    accessCodePlaceholder: 'e.g. K7M3P9',
    lookingUp: 'Looking up…',
    lookUpPass: 'Look up pass',
    unitPrefix: 'Unit: {unit}',
    managementOffice: 'Management office',
    recurringPassMeta: 'Recurring pass · {message}',
    withinSchedule: 'Within schedule',
    driveIn: 'Drive in',
    walkInEntry: 'Walk in',
    allowEntry: 'Allow entry',
    checkedInToast: '{name} checked in',
    outsideSchedule: 'Outside recurring pass schedule',
    walkInTypeAria: 'Walk-in type',
    recordOnlyHint:
      'Walk-in visit — record only. Closes automatically at end of day; no manual checkout.',
  });
  data.mobile = readJson('scripts/archive/i18n-phase3/i18n-phase3-mobile.json');
  return data;
}

const mainEn = readJson('apps/web/src/i18n/locales/en/common.json');
const mainCount = countKeys(mainEn);

const en = patchEn(structuredClone(mainEn));
writeJson('apps/web/src/i18n/locales/en/common.json', en);

// Reuse translated mobile sections from patch-mobile-locales script output if present
const ms = patchEn(structuredClone(readJson('apps/web/src/i18n/locales/ms/common.json')));
const zh = patchEn(structuredClone(readJson('apps/web/src/i18n/locales/zh-Hans/common.json')));

// Apply ms/zh translations for phase3-only keys
Object.assign(ms.actions, {
  checkIn: 'Daftar masuk',
  close: 'Tutup',
  confirm: 'Sahkan',
  save: 'Simpan',
  yes: 'Ya',
  no: 'Tidak',
  ok: 'OK',
});
Object.assign(ms.nav.guard, {
  live: 'Langsung',
  expected: 'Dijangka',
  checkIn: 'Daftar masuk',
  walkIn: 'Walk-in',
  parcels: 'Bungkusan',
  settings: 'Tetapan',
  gateHome: 'Laman utama SmartResidence Gate',
  gateNav: 'Navigasi pintu pagar',
  gateBrand: 'Pintu pagar',
});
Object.assign(ms.auth, {
  signInSubtitle: 'Selamat kembali. Log masuk untuk meneruskan.',
  email: 'E-mel',
  password: 'Kata laluan',
  totp: 'Kod 2FA',
  fullName: 'Nama penuh',
  mobilePhone: 'Telefon bimbit',
  signedInToast: 'Berjaya log masuk',
  welcomeToast: 'Selamat datang',
  totpPrompt: 'Masukkan kod 2FA anda untuk meneruskan',
  required: 'Diperlukan',
  signInFailed: 'Log masuk gagal',
  signingIn: 'Sedang log masuk…',
});
Object.assign(ms.visitors.guard, {
  checkInTitle: 'Daftar masuk pelawat',
  blockedTitle: 'Pelawat disekat',
  allowEntry: 'Benarkan masuk',
  checkedInToast: '{name} didaftar masuk',
  recordOnlyHint:
    'Lawatan walk-in — rekod sahaja. Ditutup automatik pada akhir hari; tiada daftar keluar manual.',
});
ms.mobile = readJson('scripts/archive/i18n-phase3/i18n-phase3-mobile-ms.json');
writeJson('apps/web/src/i18n/locales/ms/common.json', ms);

Object.assign(zh.actions, {
  checkIn: '登记入场',
  close: '关闭',
  confirm: '确认',
  save: '保存',
  yes: '是',
  no: '否',
  ok: '确定',
});
Object.assign(zh.nav.guard, {
  live: '实时',
  expected: '预期到访',
  checkIn: '登记入场',
  walkIn: 'Walk-in',
  parcels: '包裹',
  settings: '设置',
  gateHome: 'SmartResidence 门卫首页',
  gateNav: '门卫导航',
  gateBrand: '门卫',
});
Object.assign(zh.auth, {
  signInSubtitle: '欢迎回来，请登录继续。',
  email: '电子邮箱',
  password: '密码',
  totp: '双重验证码',
  fullName: '姓名',
  mobilePhone: '手机号码',
  signedInToast: '登录成功',
  welcomeToast: '欢迎',
  totpPrompt: '请输入双重验证码以继续',
  required: '必填',
  signInFailed: '登录失败',
  signingIn: '正在登录…',
});
Object.assign(zh.visitors.guard, {
  checkInTitle: '访客登记入场',
  blockedTitle: '访客已被拦截',
  allowEntry: '允许进入',
  checkedInToast: '{name} 已登记入场',
  recordOnlyHint: 'Walk-in 访问——仅作记录。当天结束自动关闭；无需手动离场登记。',
});
zh.mobile = readJson('scripts/archive/i18n-phase3/i18n-phase3-mobile-zh.json');
writeJson('apps/web/src/i18n/locales/zh-Hans/common.json', zh);

for (const locale of ['en', 'ms', 'zh-Hans']) {
  writeJson(
    `apps/mobile/src/i18n/locales/${locale}/common.json`,
    readJson(`apps/web/src/i18n/locales/${locale}/common.json`),
  );
}

const newCount = countKeys(en);
console.log(`main keys: ${mainCount}`);
console.log(`new keys: ${newCount}`);
console.log(`phase3 delta: ${newCount - mainCount}`);
