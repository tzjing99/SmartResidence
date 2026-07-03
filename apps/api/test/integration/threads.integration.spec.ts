/**
 * HTTP integration: resident ↔ management communication threads.
 * Covers thread creation, management reply, and AWAITING_MANAGEMENT status transition.
 */
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: threads', () => {
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

  it('resident opens a thread and management reply moves status to AWAITING_MANAGEMENT', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);
    const adminHeaders = authHeaders(fx.tokens.admin, fx.condoId);

    const createRes = await supertest(server)
      .post('/api/threads')
      .set(ownerHeaders)
      .send({
        unitId: fx.unitId,
        subject: 'Integration thread — billing query',
        category: 'BILLING',
        body: 'Please clarify my latest maintenance invoice line item.',
      })
      .expect(201);

    const thread = createRes.body.data ?? createRes.body;
    expect(thread.id).toBeTruthy();
    expect(thread.status).toBe('OPEN');

    const replyRes = await supertest(server)
      .post(`/api/threads/${thread.id}/messages`)
      .set(adminHeaders)
      .send({ body: 'Thanks — we are reviewing your invoice and will follow up shortly.' })
      .expect(201);

    expect((replyRes.body.data ?? replyRes.body).body).toContain('reviewing');

    const detailRes = await supertest(server)
      .get(`/api/threads/${thread.id}`)
      .set(ownerHeaders)
      .expect(200);

    const updated = detailRes.body.data ?? detailRes.body;
    expect(updated.status).toBe('AWAITING_MANAGEMENT');
    expect(updated.firstRespondedAt).toBeTruthy();
  });
});
