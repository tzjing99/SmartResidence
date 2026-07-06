import en from '../../../web/src/i18n/locales/en/common.json';
import ms from '../../../web/src/i18n/locales/ms/common.json';
import zhHans from '../../../web/src/i18n/locales/zh-Hans/common.json';

export type Locale = 'en' | 'ms' | 'zh-Hans';

export const DEFAULT_LOCALE: Locale = 'en';

export const MESSAGES: Record<Locale, typeof en> = {
  en,
  ms,
  'zh-Hans': zhHans,
};

export function normalizeLocale(value: string | null | undefined): Locale {
  if (value === 'ms' || value === 'zh-Hans') return value;
  return 'en';
}

function lookup(obj: Record<string, unknown>, path: string): string | undefined {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const template = lookup(MESSAGES[locale] as Record<string, unknown>, key) ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
