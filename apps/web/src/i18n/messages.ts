import enCommon from './locales/en/common.json';
import enPages from './locales/en/pages.json';
import msCommon from './locales/ms/common.json';
import msPages from './locales/ms/pages.json';
import zhCommon from './locales/zh-Hans/common.json';
import zhPages from './locales/zh-Hans/pages.json';

export type Locale = 'en' | 'ms' | 'zh-Hans';

export const DEFAULT_LOCALE: Locale = 'en';

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overlay: Record<string, unknown>,
): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overlay)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const existing = out[key];
      out[key] =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>)
          : value;
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

const en = deepMerge(enCommon, enPages);
const ms = deepMerge(msCommon, msPages);
const zhHans = deepMerge(zhCommon, zhPages);

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
  const template =
    lookup(MESSAGES[locale] as Record<string, unknown>, key) ??
    lookup(MESSAGES.en as Record<string, unknown>, key) ??
    key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
