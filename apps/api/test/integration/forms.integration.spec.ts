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

  it('approves a renovation permit, verifies by access code, and returns a PDF', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const adminHeaders = authHeaders(fx.tokens.admin, fx.condoId);
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);
    const guardHeaders = authHeaders(fx.tokens.guard, fx.condoId);

    const templateRes = await supertest(server)
      .post('/api/form-templates')
      .set(adminHeaders)
      .send({
        condoId: fx.condoId,
        kind: 'RENOVATION',
        title: 'Integration renovation permit',
        fields: {
          fields: [
            { id: 'workScope', type: 'textarea', label: 'Scope', required: true },
            { id: 'contractorCompany', type: 'text', label: 'Contractor', required: true },
            { id: 'startDate', type: 'date', label: 'Start', required: true },
            { id: 'endDate', type: 'date', label: 'End', required: true },
            {
              id: 'depositAcknowledgement',
              type: 'boolean',
              label: 'Deposit ack',
              required: true,
            },
          ],
        },
      })
      .expect(201);

    const template = templateRes.body.data ?? templateRes.body;

    const submitRes = await supertest(server)
      .post('/api/form-submissions')
      .set(ownerHeaders)
      .send({
        templateId: template.id,
        unitId: fx.unitId,
        submit: true,
        answers: {
          workScope: 'Kitchen remodel',
          contractorCompany: 'ABC Builders',
          startDate: '2026-07-01',
          endDate: '2026-08-15',
          depositAcknowledgement: true,
        },
      })
      .expect(201);

    const submission = submitRes.body.data ?? submitRes.body;

    const approveRes = await supertest(server)
      .post(`/api/form-submissions/${submission.id}/approve`)
      .set(adminHeaders)
      .expect(201);

    const approved = approveRes.body.data ?? approveRes.body;
    expect(approved.status).toBe('APPROVED');
    expect(approved.accessCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(approved.qrPayload).toContain(approved.accessCode);

    const verifyRes = await supertest(server)
      .post(`/api/form-submissions/verify/${encodeURIComponent(approved.accessCode)}`)
      .set(guardHeaders)
      .expect(201);

    const verified = verifyRes.body.data ?? verifyRes.body;
    expect(verified.passType).toBe('form_permit');
    expect(verified.valid).toBe(true);
    expect(verified.accessCode).toBe(approved.accessCode);

    const pdfRes = await supertest(server)
      .get(`/api/form-submissions/${submission.id}/pdf`)
      .set(adminHeaders)
      .expect(200);

    expect(pdfRes.headers['content-type']).toMatch(/application\/pdf/);
    expect(Buffer.isBuffer(pdfRes.body) || typeof pdfRes.body === 'string').toBe(true);
    const pdfBuf = Buffer.isBuffer(pdfRes.body) ? pdfRes.body : Buffer.from(pdfRes.body);
    expect(pdfBuf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdfBuf.length).toBeGreaterThan(800);
  });
});
