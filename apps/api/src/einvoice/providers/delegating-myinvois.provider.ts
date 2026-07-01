import { Injectable, Logger } from '@nestjs/common';
import type {
  MyInvoisCancelResult,
  MyInvoisCredentials,
  MyInvoisProvider,
  MyInvoisStatusResult,
  MyInvoisSubmitContext,
  MyInvoisSubmitResult,
} from './myinvois-provider.interface';
import { ProductionMyInvoisProvider } from './production-myinvois.provider';
import { SandboxMyInvoisProvider } from './sandbox-myinvois.provider';

/**
 * Routes MyInvois calls to the network-free sandbox adapter or the live
 * production client based on condo config:
 *
 * - SANDBOX environment → always sandbox (local validation, no LHDN HTTP).
 * - PRODUCTION + stored API credentials → {@link ProductionMyInvoisProvider}.
 * - PRODUCTION without credentials → sandbox fallback (logged) so misconfigured
 *   condos do not silently hit the live API.
 */
@Injectable()
export class DelegatingMyInvoisProvider implements MyInvoisProvider {
  readonly id = 'delegating';
  private readonly logger = new Logger(DelegatingMyInvoisProvider.name);

  constructor(
    private readonly sandbox: SandboxMyInvoisProvider,
    private readonly production: ProductionMyInvoisProvider,
  ) {}

  submit(ctx: MyInvoisSubmitContext): Promise<MyInvoisSubmitResult> {
    return this.resolve(ctx.environment, ctx.credentials).submit(ctx);
  }

  getStatus(
    uuid: string,
    environment: string,
    credentials?: MyInvoisCredentials,
  ): Promise<MyInvoisStatusResult> {
    return this.resolve(environment, credentials).getStatus(uuid, environment, credentials);
  }

  cancel(
    uuid: string,
    reason: string,
    environment: string,
    credentials?: MyInvoisCredentials,
  ): Promise<MyInvoisCancelResult> {
    return this.resolve(environment, credentials).cancel(uuid, reason, environment, credentials);
  }

  /** Exposed for tests and audit metadata. */
  resolveProviderId(environment: string, credentials?: MyInvoisCredentials): string {
    return this.resolve(environment, credentials).id;
  }

  private resolve(environment: string, credentials?: MyInvoisCredentials): MyInvoisProvider {
    if (environment === 'PRODUCTION' && credentials?.clientId && credentials?.clientSecret) {
      return this.production;
    }
    if (environment === 'PRODUCTION') {
      this.logger.warn(
        'PRODUCTION e-invoice environment selected but API credentials are missing — using sandbox adapter',
      );
    }
    return this.sandbox;
  }
}

/** True when the live MyInvois HTTP client should be used for a submission. */
export function shouldUseProductionMyInvois(
  environment: string,
  credentials?: MyInvoisCredentials,
): boolean {
  return (
    environment === 'PRODUCTION' &&
    Boolean(credentials?.clientId?.trim()) &&
    Boolean(credentials?.clientSecret?.trim())
  );
}
