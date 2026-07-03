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

  it('TNG payment: create intent, sandbox settle webhook, verify PAID and idempotent replay', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const adminHeaders = authHeaders(fx.tokens.admin, fx.condoId);
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);

    await supertest(server)
      .put(`/api/settings/condo/${fx.condoId}/billing/gateways`)
      .set(adminHeaders)
      .send({
        provider: 'TNG',
        mode: 'TEST',
        enabled: true,
        credentials: { merchantId: 'sandbox-dev' },
      })
      .expect(200);

    const invoiceRes = await supertest(server)
      .post('/api/invoices')
      .set(adminHeaders)
      .send({
        unitId: fx.unitId,
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-10-31T23:59:59.000Z',
        dueDate: '2026-10-15T00:00:00.000Z',
        lines: [{ code: 'MAINT', description: 'Oct maintenance', unitPrice: 150, quantity: 1 }],
      })
      .expect(201);

    const invoice = invoiceRes.body.data ?? invoiceRes.body;

    const payRes = await supertest(server)
      .post(`/api/invoices/${invoice.id}/payments`)
      .set(ownerHeaders)
      .send({ provider: 'TNG', returnUrl: 'http://localhost:3000/billing' })
      .expect(201);

    const intent = payRes.body.data ?? payRes.body;
    const orderid = intent.providerRef;
    const amount = Number(invoice.total).toFixed(2);
    expect(orderid).toBeTruthy();

    await supertest(server)
      .post('/api/webhooks/payments/tng/sandbox/settle')
      .send({ orderid, amount })
      .expect(201);

    const settledRes = await supertest(server)
      .get(`/api/invoices/${invoice.id}`)
      .set(adminHeaders)
      .expect(200);

    const settled = settledRes.body.data ?? settledRes.body;
    expect(settled.status).toBe('PAID');

    await supertest(server)
      .post('/api/webhooks/payments/tng/sandbox/settle')
      .send({ orderid, amount })
      .expect(201);

    const replayRes = await supertest(server)
      .get(`/api/invoices/${invoice.id}`)
      .set(adminHeaders)
      .expect(200);

    const replay = replayRes.body.data ?? replayRes.body;
    expect(replay.status).toBe('PAID');
    expect(Number(replay.amountPaid)).toBe(Number(amount));
  });
});
