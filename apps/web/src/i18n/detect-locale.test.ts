import { describe, expect, it } from 'vitest';
import {
  detectLocaleFromTags,
  mapLanguageTag,
  parseLocalePreference,
  resolveLocale,
} from './detect-locale';

describe('mapLanguageTag', () => {
  it('maps English tags to en', () => {
    expect(mapLanguageTag('en')).toBe('en');
    expect(mapLanguageTag('en-US')).toBe('en');
    expect(mapLanguageTag('en_GB')).toBe('en');
  });

  it('maps Malay tags to ms', () => {
    expect(mapLanguageTag('ms')).toBe('ms');
    expect(mapLanguageTag('ms-MY')).toBe('ms');
    expect(mapLanguageTag('msa')).toBe('ms');
    expect(mapLanguageTag('ms-Latn-MY')).toBe('ms');
  });

  it('maps Chinese tags to zh-Hans', () => {
    expect(mapLanguageTag('zh')).toBe('zh-Hans');
    expect(mapLanguageTag('zh-CN')).toBe('zh-Hans');
    expect(mapLanguageTag('zh-Hans')).toBe('zh-Hans');
    expect(mapLanguageTag('zh-Hans-CN')).toBe('zh-Hans');
  });

  it('falls back to en for unsupported languages', () => {
    expect(mapLanguageTag('fr')).toBe('en');
    expect(mapLanguageTag('ja-JP')).toBe('en');
    expect(mapLanguageTag('')).toBe('en');
    expect(mapLanguageTag(null)).toBe('en');
  });
});

describe('detectLocaleFromTags', () => {
  it('picks the first supported language in preference order', () => {
    expect(detectLocaleFromTags(['fr-FR', 'ms-MY', 'en'])).toBe('ms');
    expect(detectLocaleFromTags(['de', 'zh-CN'])).toBe('zh-Hans');
    expect(detectLocaleFromTags(['ja', 'ko'])).toBe('en');
    expect(detectLocaleFromTags(['en-MY'])).toBe('en');
  });
});

describe('locale preference', () => {
  it('parses stored preference values', () => {
    expect(parseLocalePreference('system')).toBe('system');
    expect(parseLocalePreference('zh-Hans')).toBe('zh-Hans');
    expect(parseLocalePreference('fr')).toBeNull();
  });

  it('resolves system vs explicit override', () => {
    expect(resolveLocale('system', 'ms')).toBe('ms');
    expect(resolveLocale('en', 'ms')).toBe('en');
    expect(resolveLocale('zh-Hans', 'en')).toBe('zh-Hans');
  });
});
