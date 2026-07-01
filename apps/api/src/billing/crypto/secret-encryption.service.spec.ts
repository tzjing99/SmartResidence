import type { AppEnv } from '@/config/env.schema';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { SecretEncryptionService } from './secret-encryption.service';

function makeService(key?: string) {
  const config = {
    get: (name: string) =>
      name === 'NODE_ENV' ? 'test' : name === 'BILLING_ENCRYPTION_KEY' ? key : undefined,
  } as unknown as ConfigService<AppEnv, true>;
  return new SecretEncryptionService(config);
}

describe('SecretEncryptionService', () => {
  it('round-trips a string with a dev-derived key', () => {
    const svc = makeService();
    const enc = svc.encrypt('sk_test_secret');
    expect(svc.decrypt(enc)).toBe('sk_test_secret');
  });

  it('round-trips a credentials object', () => {
    const svc = makeService(Buffer.alloc(32, 7).toString('base64'));
    const enc = svc.encryptJson({ merchantCode: 'M1', merchantKey: 'K1' });
    expect(svc.decryptJson(enc)).toEqual({ merchantCode: 'M1', merchantKey: 'K1' });
  });

  it('fails to decrypt when the auth tag is tampered', () => {
    const svc = makeService();
    const enc = svc.encrypt('secret');
    const badTag = Buffer.from(enc.authTag);
    badTag[0] ^= 0xff;
    expect(() => svc.decrypt({ ...enc, authTag: badTag })).toThrow();
  });
});
