import { describe, expect, it } from 'vitest';
import { type Locale, MESSAGES, translate } from './messages';

const locales = Object.keys(MESSAGES) as Locale[];

const authKeys = [
  'auth.signIn',
  'auth.signUp',
  'auth.welcomeBack',
  'auth.signInBlurb',
  'auth.email',
  'auth.password',
  'auth.required',
  'auth.signedInToast',
  'auth.totpPrompt',
  'auth.totp',
  'auth.newHere',
  'auth.demoHint',
  'auth.useDemoAccount',
  'auth.passwordMinLength',
  'auth.passwordUppercase',
  'auth.passwordLowercase',
  'auth.passwordDigit',
  'auth.welcomeToast',
  'auth.createAccountTitle',
  'auth.signUpBlurb',
  'auth.fullName',
  'auth.mobilePhone',
  'auth.phoneHint',
  'auth.passwordHint',
  'auth.alreadyHaveAccount',
] as const;

const accessRestrictedKeys = [
  'billing.accessRestrictedTitle',
  'billing.accessRestrictedBody',
  'billing.accessRestrictedBannerBody',
  'billing.accessRestrictedPay',
] as const;

const deliveryKeys = [
  'visitors.delivery.headline',
  'visitors.delivery.headlineSuggested',
  'visitors.delivery.subtitle',
  'visitors.delivery.suggestedFromHistory',
  'visitors.delivery.durationBadge',
  'visitors.delivery.kindLabel',
  'visitors.delivery.kindFood',
  'visitors.delivery.kindRide',
  'visitors.delivery.platformLabel',
  'visitors.delivery.platformHint',
  'visitors.delivery.nameLabel',
  'visitors.delivery.namePlaceholder',
  'visitors.delivery.plateLabel',
  'visitors.delivery.platePlaceholder',
  'visitors.delivery.arrivalLabel',
  'visitors.delivery.validityHint',
  'visitors.delivery.createPass',
] as const;

describe('authentication translations', () => {
  it.each(locales)('defines every authentication key for %s', (locale) => {
    for (const key of authKeys) {
      expect(translate(locale, key), `${locale} is missing ${key}`).not.toBe(key);
    }
  });

  it('interpolates demo credentials', () => {
    expect(
      translate('en', 'auth.demoHint', {
        email: 'owner@acacia.demo',
        password: 'Demo!2026',
      }),
    ).toBe('Demo: owner@acacia.demo / Demo!2026');
  });
});

describe('delivery quick-pass translations', () => {
  it.each(locales)('defines every quick-pass key for %s', (locale) => {
    for (const key of deliveryKeys) {
      expect(translate(locale, key), `${locale} is missing ${key}`).not.toBe(key);
    }
  });
});

describe('arrears access-restricted translations', () => {
  it.each(locales)('defines pay-to-unlock keys for %s', (locale) => {
    for (const key of accessRestrictedKeys) {
      expect(translate(locale, key), `${locale} is missing ${key}`).not.toBe(key);
    }
  });
});
