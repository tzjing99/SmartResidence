/**
 * Regression suite — critical business paths that must never break.
 * Runs against a real Postgres test database (@requires-db).
 */
import type { INestApplication } from '@nestjs/common';
import { depositHeldAmount } from '@smartresidence/shared-types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureIntegrationEnv } from '../helpers/integration-env';
import type { IntegrationFixtures } from '../helpers/integration-types';

const regressionReady = ensureIntegrationEnv();

/** @requires-db */
describe.skipIf(!regressionReady)('Regression: critical paths', () => {
  let app: INestApplication;
  let fx: IntegrationFixtures;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let billing: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ledger: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let polls: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deposits: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let blacklist: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auth: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeAll(async () => {
    const { createTestApp } = await import('../helpers/create-test-app');
    const { seedIntegrationFixtures } = await import('../helpers/integration-fixtures');
    const boot = await createTestApp();
    app = boot.app;
    prisma = boot.prisma;
    fx = await seedIntegrationFixtures(prisma, app);

    const { BillingService } = await import('@/billing/billing.service');
    const { LedgerService } = await import('@/billing/ledger.service');
    const { PollsService } = await import('@/polls/polls.service');
    const { DepositService } = await import('@/billing/deposit.service');
    const { VisitorBlacklistService } = await import('@/visitor/visitor-blacklist.service');
    const { AuthService } = await import('@/auth/auth.service');

    billing = app.get(BillingService);
    ledger = app.get(LedgerService);
    polls = app.get(PollsService);
    deposits = app.get(DepositService);
    blacklist = app.get(VisitorBlacklistService);
    auth = app.get(AuthService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('billing: generateRecurring skips units already invoiced for the period', async () => {
    const admin = await auth.loadUser(fx.userIds.admin, fx.condoId);
    const periodStart = new Date('2026-08-01T00:00:00Z');
    const periodEnd = new Date('2026-08-31T23:59:59Z');
    const dueDate = new Date('2026-08-15T00:00:00Z');

    await billing.generateRecurring(admin, fx.condoId, {
      periodStart,
      periodEnd,
      dueDate,
      lines: [{ code: 'MAINT', description: 'Maintenance', unitPrice: 250, quantity: 1 }],
    });

    const secondRun = await billing.generateRecurring(admin, fx.condoId, {
      periodStart,
      periodEnd,
      dueDate,
      lines: [{ code: 'MAINT', description: 'Maintenance', unitPrice: 250, quantity: 1 }],
    });

    expect(secondRun.created).toBe(0);
    expect(secondRun.skipped).toBeGreaterThanOrEqual(2);
  });

  it('billing: markPaymentSucceeded is idempotent for the same provider reference', async () => {
    const admin = await auth.loadUser(fx.userIds.admin, fx.condoId);

    const invoice = await prisma.invoice.create({
      data: {
        condoId: fx.condoId,
        unitId: fx.secondUnitId,
        number: `INV-REG-${Date.now()}`,
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        dueDate: new Date('2026-09-15'),
        status: 'ISSUED',
        subtotal: 100,
        total: 100,
        currencyCode: 'MYR',
        issuedAt: new Date(),
      },
    });

    const providerRef = `reg-idem-${Date.now()}`;
    await prisma.payment.create({
      data: {
        sourceType: 'Invoice', sourceId: invoice.id,
        userId: fx.userIds.admin,
        amount: 100,
        currencyCode: 'MYR',
        status: 'PENDING',
        provider: 'STRIPE',
        providerRef,
      },
    });

    const first = await billing.markPaymentSucceeded(providerRef);
    const second = await billing.markPaymentSucceeded(providerRef);
    expect(first?.status).toBe('SUCCEEDED');
    expect(second?.status).toBe('SUCCEEDED');

    const settled = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(Number(settled?.amountPaid)).toBeCloseTo(100);
    expect(settled?.status).toBe('PAID');

    await expect(
      billing.recordManualPayment(admin, invoice.id, { amount: 1 }),
    ).rejects.toThrow();
  });

  it('ledger: maintenance and sinking invoice lines post to separate funds', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        condoId: fx.condoId,
        unitId: fx.secondUnitId,
        number: `INV-LEDGER-${Date.now()}`,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        dueDate: new Date('2026-07-15'),
        status: 'ISSUED',
        subtotal: 400,
        total: 400,
        currencyCode: 'MYR',
        issuedAt: new Date(),
        lines: {
          create: [
            {
              code: 'MAINT',
              description: 'Maintenance',
              quantity: 1,
              unitPrice: 300,
              amount: 300,
              sortOrder: 0,
            },
            {
              code: 'SINK',
              description: 'Sinking fund',
              quantity: 1,
              unitPrice: 100,
              amount: 100,
              sortOrder: 1,
            },
          ],
        },
      },
      include: { lines: true },
    });

    await prisma.$transaction(async (tx: typeof prisma) => {
      await ledger.recordInvoiceCharges(
        tx,
        invoice,
        invoice.lines.map((line: { code: string; amount: unknown; description: string }) => ({
          code: line.code,
          amount: Number(line.amount),
          description: line.description,
        })),
        fx.userIds.admin,
      );
    });

    const entries = await prisma.ledgerEntry.findMany({
      where: { sourceType: 'Invoice', sourceId: invoice.id, type: 'CHARGE' },
    });
    const maint = entries.find((e: { fund: string }) => e.fund === 'MAINTENANCE');
    const sink = entries.find((e: { fund: string }) => e.fund === 'SINKING_FUND');
    expect(Number(maint?.amount)).toBeCloseTo(300);
    expect(Number(sink?.amount)).toBeCloseTo(100);
  });

  it('polls: one vote per unit — duplicate vote is rejected', async () => {
    const owner = await auth.loadUser(fx.userIds.owner, fx.condoId);

    const poll = await prisma.poll.create({
      data: {
        condoId: fx.condoId,
        title: 'Regression poll',
        description: 'One vote per unit',
        status: 'OPEN',
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 86_400_000),
        audienceScope: 'ALL_OWNERS',
        createdByUserId: fx.userIds.admin,
        options: {
          create: [
            { label: 'Yes', position: 0 },
            { label: 'No', position: 1 },
          ],
        },
      },
      include: { options: true },
    });

    const optionId = poll.options[0]?.id;
    expect(optionId).toBeTruthy();

    await polls.castVote(owner, poll.id, { unitId: fx.unitId, optionId: optionId! });
    await expect(
      polls.castVote(owner, poll.id, { unitId: fx.unitId, optionId: poll.options[1]!.id }),
    ).rejects.toThrow();
  });

  it('visitor: blacklist blocks matching identifiers at the gate', async () => {
    const admin = await auth.loadUser(fx.userIds.admin, fx.condoId);
    await blacklist.create(fx.condoId, admin, {
      name: 'Blocked Visitor',
      phone: '+60199887766',
      reason: 'Regression test block',
    });

    await expect(
      blacklist.assertNotBlacklisted(fx.condoId, {
        name: 'Blocked Visitor',
        phone: '+60199887766',
      }),
    ).rejects.toMatchObject({ name: 'VisitorBlacklistBlockedError' });
  });

  it('deposits: held amount reflects partial refunds', async () => {
    const admin = await auth.loadUser(fx.userIds.admin, fx.condoId);
    const recorded = await deposits.record(admin, {
      unitId: fx.unitId,
      type: 'RENOVATION',
      amount: 1000,
      method: 'Bank transfer',
      reference: `REG-DEP-${Date.now()}`,
    });

    await deposits.refund(admin, recorded.id, { amount: 400 });

    const updated = await prisma.deposit.findUniqueOrThrow({ where: { id: recorded.id } });
    const held = depositHeldAmount({
      amount: updated.amount,
      refundedAmount: updated.refundedAmount,
      forfeitedAmount: updated.forfeitedAmount,
    });
    expect(held).toBeCloseTo(600);
  });
});
