/**
 * HTTP integration: parcel logging and resident visibility.
 * Guard logs a parcel for a unit; the unit owner sees it in their parcel list.
 */
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: parcels', () => {
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

  it('guard logs a parcel and the unit owner sees it', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const guardHeaders = authHeaders(fx.tokens.guard, fx.condoId);
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);
    const trackingRef = `INT-${Date.now()}`;

    const createRes = await supertest(server)
      .post('/api/parcels')
      .set(guardHeaders)
      .send({
        condoId: fx.condoId,
        unitId: fx.unitId,
        recipientName: 'Integration Owner',
        carrier: 'PosLaju',
        trackingRef,
      })
      .expect(201);

    const parcel = createRes.body.data ?? createRes.body;
    expect(parcel.id).toBeTruthy();
    expect(parcel.unitId).toBe(fx.unitId);
    expect(parcel.status).toMatch(/RECEIVED|NOTIFIED/);

    const listRes = await supertest(server)
      .get(`/api/parcels/unit/${fx.unitId}`)
      .set(ownerHeaders)
      .expect(200);

    const payload = listRes.body.data ?? listRes.body;
    const items = payload.items ?? payload;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((p: { trackingRef?: string }) => p.trackingRef === trackingRef)).toBe(true);
  });
});
