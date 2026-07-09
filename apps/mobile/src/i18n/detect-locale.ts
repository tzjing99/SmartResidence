import * as Localization from 'expo-localization';
import {
  DEFAULT_LOCALE,
  type Locale,
  type LocalePreference,
  detectLocaleFromTags,
  mapLanguageTag,
  parseLocalePreference,
  resolveLocale,
} from '../../../web/src/i18n/detect-locale';

export {
  DEFAULT_LOCALE,
  detectLocaleFromTags,
  mapLanguageTag,
  parseLocalePreference,
  resolveLocale,
  type Locale,
  type LocalePreference,
};

export const LOCALE_STORAGE_KEY = '@smartresidence/locale-preference';

/** Device locale via expo-localization (iOS + Android). */
export function detectDeviceLocale(): Locale {
  const locales = Localization.getLocales();
  const tags = locales
    .map((entry) => entry.languageTag || entry.languageCode)
    .filter((tag): tag is string => Boolean(tag));
  if (tags.length === 0) {
    return DEFAULT_LOCALE;
  }
  return detectLocaleFromTags(tags);
}
