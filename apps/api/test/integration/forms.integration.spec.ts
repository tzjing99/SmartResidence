/**
 * HTTP integration: condo form submissions workflow.
 * Resident submits a form; management sees it in the SUBMITTED (pending review) queue.
 */
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: forms', () => {
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

  it('resident submits a form and management lists it as SUBMITTED (pending review)', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const adminHeaders = authHeaders(fx.tokens.admin, fx.condoId);
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);

    const templateRes = await supertest(server)
      .post('/api/form-templates')
      .set(adminHeaders)
      .send({
        condoId: fx.condoId,
        kind: 'MOVE_IN',
        title: 'Integration move-in form',
        fields: {
          fields: [
            { id: 'moveDate', type: 'date', label: 'Move-in date', required: true },
            { id: 'notes', type: 'textarea', label: 'Notes' },
          ],
        },
      })
      .expect(201);

    const template = templateRes.body.data ?? templateRes.body;
    expect(template.id).toBeTruthy();

    const submitRes = await supertest(server)
      .post('/api/form-submissions')
      .set(ownerHeaders)
      .send({
        templateId: template.id,
        unitId: fx.unitId,
        submit: true,
        answers: { moveDate: '2026-08-01', notes: 'Integration test submission' },
      })
      .expect(201);

    const submission = submitRes.body.data ?? submitRes.body;
    expect(submission.status).toBe('SUBMITTED');
    expect(submission.submittedAt).toBeTruthy();

    const queueRes = await supertest(server)
      .get(`/api/form-submissions/condo/${fx.condoId}?status=SUBMITTED`)
      .set(adminHeaders)
      .expect(200);

    const payload = queueRes.body.data ?? queueRes.body;
    const items = payload.items ?? payload;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((s: { id: string }) => s.id === submission.id)).toBe(true);
  });
});
