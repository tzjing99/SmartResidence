import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaders, ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const integrationReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!integrationReady)('Integration: governance', () => {
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

  it('management creates a meeting draft, publishes notice, opens voting, owner casts a vote', async () => {
    const supertest = (await import('supertest')).default;
    const server = app.getHttpServer();
    const adminHeaders = authHeaders(fx.tokens.admin, fx.condoId);
    const ownerHeaders = authHeaders(fx.tokens.owner, fx.condoId);

    const createRes = await supertest(server)
      .post('/api/governance')
      .set(adminHeaders)
      .send({
        condoId: fx.condoId,
        kind: 'EGM',
        title: 'Integration governance meeting',
        scheduledAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        noticeBody: 'Notice of extraordinary general meeting for integration tests.',
      })
      .expect(201);

    const meeting = createRes.body.data ?? createRes.body;
    expect(meeting.status).toBe('DRAFT');

    const publishRes = await supertest(server)
      .post(`/api/governance/${meeting.id}/publish-notice`)
      .set(adminHeaders)
      .expect(201);

    expect((publishRes.body.data ?? publishRes.body).status).toBe('NOTICE_PUBLISHED');

    const resolutionRes = await supertest(server)
      .post(`/api/governance/${meeting.id}/resolutions`)
      .set(adminHeaders)
      .send({
        title: 'Approve integration test budget',
        description: 'Routine regression coverage resolution.',
      })
      .expect(201);

    const resolution = resolutionRes.body.data ?? resolutionRes.body;

    const openRes = await supertest(server)
      .post(`/api/governance/resolutions/${resolution.id}/open-voting`)
      .set(adminHeaders)
      .send({})
      .expect(201);

    const opened = openRes.body.data ?? openRes.body;
    expect(opened.pollId).toBeTruthy();

    const pollRes = await supertest(server)
      .get(`/api/polls/${opened.pollId}`)
      .set(ownerHeaders)
      .expect(200);

    const poll = pollRes.body.data ?? pollRes.body;
    const optionId = poll.options?.[0]?.id;
    expect(optionId).toBeTruthy();

    const voteRes = await supertest(server)
      .post(`/api/governance/resolutions/${resolution.id}/vote`)
      .set(ownerHeaders)
      .send({ unitId: fx.unitId, optionId })
      .expect(201);

    const votes = voteRes.body.data ?? voteRes.body;
    expect(Array.isArray(votes)).toBe(true);
    expect(votes.length).toBeGreaterThan(0);

    const publishedMeeting = publishRes.body.data ?? publishRes.body;
    expect(publishedMeeting.financialSnapshot?.fundBalances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fund: expect.any(String), balance: expect.any(Number) }),
      ]),
    );

    await supertest(server)
      .post(`/api/governance/resolutions/${resolution.id}/close-voting`)
      .set(adminHeaders)
      .expect(201);

    await supertest(server)
      .patch(`/api/governance/${meeting.id}`)
      .set(adminHeaders)
      .send({ minutesBody: 'Integration test AGM minutes.' })
      .expect(200);

    const minutesRes = await supertest(server)
      .post(`/api/governance/${meeting.id}/publish-minutes`)
      .set(adminHeaders)
      .send({})
      .expect(201);

    const withMinutes = minutesRes.body.data ?? minutesRes.body;
    expect(withMinutes.minutesPublishedAt).toBeTruthy();
    expect(withMinutes.minutesBody).toContain('Integration test AGM minutes');

    const ownerMeetingRes = await supertest(server)
      .get(`/api/governance/${meeting.id}`)
      .set(ownerHeaders)
      .expect(200);

    const ownerView = ownerMeetingRes.body.data ?? ownerMeetingRes.body;
    expect(ownerView.minutesBody).toContain('Integration test AGM minutes');
    expect(ownerView.financialSnapshot?.fundBalances?.length).toBeGreaterThan(0);
  });
});
