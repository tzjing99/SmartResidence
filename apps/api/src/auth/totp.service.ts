import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

@Injectable()
export class TotpService {
  /** Generate a fresh secret to enroll a user in 2FA. */
  generateSecret(): string {
    return authenticator.generateSecret(32);
  }

  /** Build the otpauth:// URI used by authenticator apps and QR codes. */
  uri(label: string, secret: string, issuer = 'SmartResidence'): string {
    return authenticator.keyuri(label, issuer, secret);
  }

  verify(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }
}
