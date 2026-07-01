import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { AppEnv } from '@/config/env.schema';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EncryptedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_VERSION = 1;

/**
 * Envelope-encrypts payment gateway credentials at rest with AES-256-GCM.
 * The master key comes from `BILLING_ENCRYPTION_KEY` (base64 or hex, 32 bytes).
 * In development a deterministic key is derived so local setup works without
 * configuration; production MUST provide a strong random key.
 */
@Injectable()
export class SecretEncryptionService {
  private readonly logger = new Logger(SecretEncryptionService.name);
  private readonly key: Buffer;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>) {
    const raw = config.get('BILLING_ENCRYPTION_KEY', { infer: true }) as string | undefined;
    this.key = this.deriveKey(raw, config.get('NODE_ENV', { infer: true }));
  }

  private deriveKey(raw: string | undefined, nodeEnv: string): Buffer {
    if (raw) {
      // Accept base64 or hex; fall back to hashing arbitrary strings to 32 bytes.
      const tryDecode = (enc: BufferEncoding): Buffer | null => {
        try {
          const buf = Buffer.from(raw, enc);
          return buf.length === 32 ? buf : null;
        } catch {
          return null;
        }
      };
      const decoded = tryDecode('base64') ?? tryDecode('hex');
      if (decoded) return decoded;
      return createHash('sha256').update(raw).digest();
    }
    if (nodeEnv === 'production') {
      throw new Error('BILLING_ENCRYPTION_KEY must be set in production');
    }
    this.logger.warn(
      'BILLING_ENCRYPTION_KEY not set; using a derived dev key. Do NOT use in production.',
    );
    return createHash('sha256').update('smartresidence-dev-billing-key').digest();
  }

  encrypt(plaintext: string): EncryptedSecret {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag, keyVersion: KEY_VERSION };
  }

  decrypt(secret: {
    ciphertext: Buffer | Uint8Array;
    iv: Buffer | Uint8Array;
    authTag: Buffer | Uint8Array;
  }): string {
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(secret.iv));
    decipher.setAuthTag(Buffer.from(secret.authTag));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext)),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  /** Encrypt a JSON-serialisable credentials object. */
  encryptJson(value: Record<string, unknown>): EncryptedSecret {
    return this.encrypt(JSON.stringify(value));
  }

  /** Decrypt back into a credentials object. */
  decryptJson<T = Record<string, unknown>>(secret: {
    ciphertext: Buffer | Uint8Array;
    iv: Buffer | Uint8Array;
    authTag: Buffer | Uint8Array;
  }): T {
    return JSON.parse(this.decrypt(secret)) as T;
  }
}
