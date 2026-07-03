import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: billing', () => {
  let app: INestApplication;
  let fx: IntegrationFixtures;

  beforeAll(async () => {
    const { createTestApp } = await import('../helpers/create-test-app');
    const { seedIntegrationFixtures } = await import('../helpers/integration-fixtures');
    const boot = await createTestApp();
    app = boot.app;
    fx = await seedIntegrationFixtures(boot.prisma, app);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/invoices/unit/:unitId lists invoices for the unit owner', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get(`/api/invoices/unit/${fx.unitId}`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(Array.isArray(payload.items ?? payload)).toBe(true);
  });

  it('GET /api/billing/reports/condo/:condoId/fund-balances (management)', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get(`/api/billing/reports/condo/${fx.condoId}/fund-balances`)
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .expect(200);

    const rows = res.body.data ?? res.body;
    expect(Array.isArray(rows)).toBe(true);
  });

  it('GET /api/billing/reports/condo/:condoId/arrears (management)', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get(`/api/billing/reports/condo/${fx.condoId}/arrears`)
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .expect(200);

    const payload = res.body.data ?? res.body;
    expect(payload).toBeTruthy();
  });

  it('GET /api/billing/condo/:condoId/statements/unit/:unitId.pdf returns application/pdf', async () => {
    const supertest = (await import('supertest')).default;
    const from = '2026-01-01';
    const to = '2026-12-31';
    const res = await supertest(app.getHttpServer())
      .get(
        `/api/billing/condo/${fx.condoId}/statements/unit/${fx.unitId}.pdf?from=${from}&to=${to}`,
      )
      .set(authHeaders(fx.tokens.admin, fx.condoId))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('GET /api/billing/units/:unitId/statement.csv returns CSV for the unit owner', async () => {
    const supertest = (await import('supertest')).default;
    const res = await supertest(app.getHttpServer())
      .get(`/api/billing/units/${fx.unitId}/statement.csv`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Unit account statement');
  });

  it('GET /api/billing/units/:unitId/statement.csv returns 403 for another unit', async () => {
    const supertest = (await import('supertest')).default;
    await supertest(app.getHttpServer())
      .get(`/api/billing/units/${fx.secondUnitId}/statement.csv`)
      .set(authHeaders(fx.tokens.owner, fx.condoId))
      .expect(403);
  });
});
