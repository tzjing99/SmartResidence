import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  DepositStatus,
  type DepositType,
  type Prisma,
  ReceiptKind,
  RoleId,
} from '@prisma/client';
import { DEPOSIT_TYPE_LABELS, depositHeldAmount } from '@smartresidence/shared-types';
import type { RecordDepositDto, RefundDepositDto } from './dto/deposit.dto';
import { LedgerService } from './ledger.service';
import { ReceiptService } from './receipt.service';

@Injectable()
export class DepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly receipts: ReceiptService,
    private readonly ledger: LedgerService,
  ) {}

  async listForCondo(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { limit: number; offset: number; status?: DepositStatus; unitId?: string },
  ) {
    this.assertCanReadCondo(actor, condoId);
    const where = {
      condoId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.unitId ? { unitId: opts.unitId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deposit.findMany({
        where,
        include: {
          unit: { include: { block: true } },
          user: { select: { id: true, name: true } },
          receipt: { select: { id: true, number: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.deposit.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async listForUnit(
    actor: AuthenticatedUser,
    unitId: string,
    opts: { limit: number; offset: number },
  ) {
    await this.assertCanReadUnit(actor, unitId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deposit.findMany({
        where: { unitId },
        include: { receipt: { select: { id: true, number: true } } },
        orderBy: { paidAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.deposit.count({ where: { unitId } }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async record(actor: AuthenticatedUser, dto: RecordDepositDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    this.assertManagement(actor, unit.condoId);
    if (dto.amount <= 0) throw new BadRequestException('Deposit amount must be greater than zero');

    const result = await this.prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.create({
        data: {
          condoId: unit.condoId,
          unitId: unit.id,
          userId: dto.userId ?? null,
          type: dto.type,
          amount: dto.amount,
          currencyCode: 'MYR',
          status: DepositStatus.HELD,
          method: dto.method ?? null,
          reference: dto.reference ?? null,
          paidAt: dto.paidAt ?? new Date(),
          notes: dto.notes ?? null,
          recordedByUserId: actor.id,
        },
      });

      const receipt = await this.receipts.issueInTx(tx, {
        condoId: unit.condoId,
        kind: ReceiptKind.DEPOSIT,
        amount: dto.amount,
        currencyCode: deposit.currencyCode,
        issuedToUserId: dto.userId ?? null,
        unitId: unit.id,
        depositId: deposit.id,
        description: DEPOSIT_TYPE_LABELS[dto.type],
      });

      await this.ledger.record(tx, {
        condoId: unit.condoId,
        unitId: unit.id,
        fund: 'DEPOSIT',
        type: 'DEPOSIT',
        amount: dto.amount,
        idempotencyKey: `deposit:${deposit.id}:held`,
        sourceType: 'Deposit',
        sourceId: deposit.id,
        memo: DEPOSIT_TYPE_LABELS[dto.type],
        createdByUserId: actor.id,
      });

      await tx.auditLog.create({
        data: {
          condoId: unit.condoId,
          unitId: unit.id,
          actorUserId: actor.id,
          action: AuditAction.CREATE,
          resourceType: 'Deposit',
          resourceId: deposit.id,
          metadata: { type: dto.type, amount: dto.amount, receiptId: receipt.id },
        },
      });

      return { deposit, receipt };
    });

    this.events.emit('deposit.recorded', {
      depositId: result.deposit.id,
      receiptId: result.receipt.id,
    });
    return this.get(actor, result.deposit.id);
  }

  /**
   * Record a HELD deposit inside a caller-supplied transaction, reusing the
   * shared receipt + ledger helpers. Skips the management authorization check
   * because the caller (e.g. a resident confirming a facility booking) has
   * already been authorized for the originating action.
   */
  async recordInTx(
    tx: Prisma.TransactionClient,
    input: {
      condoId: string;
      unitId: string;
      userId?: string | null;
      type: DepositType;
      amount: number;
      description?: string | null;
      notes?: string | null;
      recordedByUserId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const deposit = await tx.deposit.create({
      data: {
        condoId: input.condoId,
        unitId: input.unitId,
        userId: input.userId ?? null,
        type: input.type,
        amount: input.amount,
        currencyCode: 'MYR',
        status: DepositStatus.HELD,
        paidAt: new Date(),
        notes: input.notes ?? null,
        recordedByUserId: input.recordedByUserId ?? null,
        metadata: input.metadata ?? {},
      },
    });
    const description = input.description ?? DEPOSIT_TYPE_LABELS[input.type];
    const receipt = await this.receipts.issueInTx(tx, {
      condoId: input.condoId,
      kind: ReceiptKind.DEPOSIT,
      amount: input.amount,
      currencyCode: deposit.currencyCode,
      issuedToUserId: input.userId ?? null,
      unitId: input.unitId,
      depositId: deposit.id,
      description,
    });
    await this.ledger.record(tx, {
      condoId: input.condoId,
      unitId: input.unitId,
      fund: 'DEPOSIT',
      type: 'DEPOSIT',
      amount: input.amount,
      idempotencyKey: `deposit:${deposit.id}:held`,
      sourceType: 'Deposit',
      sourceId: deposit.id,
      memo: description,
      createdByUserId: input.recordedByUserId ?? null,
    });
    return { deposit, receipt };
  }

  /**
   * Refund the full remaining held balance of a deposit inside a
   * caller-supplied transaction (e.g. releasing a facility booking deposit on
   * cancellation). No-op when nothing remains held. Reuses receipt + ledger.
   */
  async refundHeldInTx(
    tx: Prisma.TransactionClient,
    depositId: string,
    actorUserId?: string | null,
  ): Promise<number> {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) return 0;
    const held = depositHeldAmount({
      amount: Number(deposit.amount),
      refundedAmount: Number(deposit.refundedAmount),
      forfeitedAmount: Number(deposit.forfeitedAmount),
    });
    if (held <= 0.005) return 0;
    await tx.deposit.update({
      where: { id: depositId },
      data: {
        refundedAmount: Number(deposit.refundedAmount) + held,
        status: DepositStatus.REFUNDED,
        refundedAt: new Date(),
      },
    });
    await this.receipts.issueInTx(tx, {
      condoId: deposit.condoId,
      kind: ReceiptKind.REFUND,
      amount: held,
      currencyCode: deposit.currencyCode,
      issuedToUserId: deposit.userId,
      unitId: deposit.unitId,
      description: `Refund — ${DEPOSIT_TYPE_LABELS[deposit.type]}`,
    });
    await this.ledger.record(tx, {
      condoId: deposit.condoId,
      unitId: deposit.unitId,
      fund: 'DEPOSIT',
      type: 'REFUND',
      amount: -held,
      idempotencyKey: `deposit:${depositId}:refund:${Number(deposit.refundedAmount) + held}`,
      sourceType: 'Deposit',
      sourceId: depositId,
      memo: `Refund — ${DEPOSIT_TYPE_LABELS[deposit.type]}`,
      createdByUserId: actorUserId ?? null,
    });
    return held;
  }

  async refund(actor: AuthenticatedUser, id: string, dto: RefundDepositDto) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id } });
    if (!deposit) throw new NotFoundException('Deposit not found');
    this.assertManagement(actor, deposit.condoId);

    const held = depositHeldAmount({
      amount: Number(deposit.amount),
      refundedAmount: Number(deposit.refundedAmount),
      forfeitedAmount: Number(deposit.forfeitedAmount),
    });
    if (held <= 0) throw new BadRequestException('Nothing left to refund on this deposit');
    const amount = dto.amount != null ? Number(dto.amount) : held;
    if (amount <= 0) throw new BadRequestException('Refund amount must be greater than zero');
    if (amount > held + 0.005) throw new BadRequestException('Refund exceeds the held balance');

    const forfeit = dto.forfeit === true;
    const newRefunded = Number(deposit.refundedAmount) + (forfeit ? 0 : amount);
    const newForfeited = Number(deposit.forfeitedAmount) + (forfeit ? amount : 0);
    const remaining = Number(deposit.amount) - newRefunded - newForfeited;
    const status =
      remaining <= 0.005
        ? newForfeited > 0 && newRefunded <= 0.005
          ? DepositStatus.FORFEITED
          : DepositStatus.REFUNDED
        : DepositStatus.PARTIALLY_REFUNDED;

    await this.prisma.$transaction(async (tx) => {
      await tx.deposit.update({
        where: { id },
        data: {
          refundedAmount: newRefunded,
          forfeitedAmount: newForfeited,
          status,
          refundedAt: remaining <= 0.005 ? new Date() : deposit.refundedAt,
        },
      });

      if (forfeit) {
        // Reclassify forfeited deposit from the deposit liability to income.
        await this.ledger.record(tx, {
          condoId: deposit.condoId,
          unitId: deposit.unitId,
          fund: 'DEPOSIT',
          type: 'ADJUSTMENT',
          amount: -amount,
          idempotencyKey: `deposit:${id}:forfeit:liability:${newForfeited}`,
          sourceType: 'Deposit',
          sourceId: id,
          memo: `Forfeited — ${DEPOSIT_TYPE_LABELS[deposit.type]}`,
          createdByUserId: actor.id,
        });
        await this.ledger.record(tx, {
          condoId: deposit.condoId,
          unitId: deposit.unitId,
          fund: 'GENERAL',
          type: 'ADJUSTMENT',
          amount,
          idempotencyKey: `deposit:${id}:forfeit:income:${newForfeited}`,
          sourceType: 'Deposit',
          sourceId: id,
          memo: `Forfeited deposit income — ${DEPOSIT_TYPE_LABELS[deposit.type]}`,
          createdByUserId: actor.id,
        });
      } else {
        await this.receipts.issueInTx(tx, {
          condoId: deposit.condoId,
          kind: ReceiptKind.REFUND,
          amount,
          currencyCode: deposit.currencyCode,
          issuedToUserId: deposit.userId,
          unitId: deposit.unitId,
          description: `Refund — ${DEPOSIT_TYPE_LABELS[deposit.type]}`,
        });
        await this.ledger.record(tx, {
          condoId: deposit.condoId,
          unitId: deposit.unitId,
          fund: 'DEPOSIT',
          type: 'REFUND',
          amount: -amount,
          idempotencyKey: `deposit:${id}:refund:${newRefunded}`,
          sourceType: 'Deposit',
          sourceId: id,
          memo: `Refund — ${DEPOSIT_TYPE_LABELS[deposit.type]}`,
          createdByUserId: actor.id,
        });
      }

      await tx.auditLog.create({
        data: {
          condoId: deposit.condoId,
          unitId: deposit.unitId,
          actorUserId: actor.id,
          action: AuditAction.UPDATE,
          resourceType: 'Deposit',
          resourceId: id,
          metadata: { refund: !forfeit, forfeit, amount, note: dto.note ?? null },
        },
      });
    });

    this.events.emit('deposit.refunded', { depositId: id, amount, forfeit });
    return this.get(actor, id);
  }

  async get(actor: AuthenticatedUser, id: string) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id },
      include: {
        unit: { include: { block: true } },
        user: { select: { id: true, name: true } },
        receipt: { select: { id: true, number: true } },
      },
    });
    if (!deposit) throw new NotFoundException('Deposit not found');
    this.assertCanReadDeposit(actor, deposit.condoId, deposit.unitId, deposit.userId);
    return deposit;
  }

  private assertCanReadCondo(user: AuthenticatedUser, condoId: string): void {
    const ok = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
    if (!ok) throw new ForbiddenException('You cannot access deposits for this condo');
  }

  private async assertCanReadUnit(user: AuthenticatedUser, unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (this.canReadDeposit(user, unit.condoId, unitId, null)) return;
    throw new ForbiddenException('You cannot access deposits for this unit');
  }

  private assertCanReadDeposit(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string,
    userId: string | null,
  ): void {
    if (this.canReadDeposit(user, condoId, unitId, userId)) return;
    throw new ForbiddenException('You cannot access this deposit');
  }

  private canReadDeposit(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string,
    userId: string | null,
  ): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId) ||
        r.unitId === unitId ||
        (userId != null && user.id === userId),
    );
  }

  private assertManagement(user: AuthenticatedUser, condoId: string): void {
    const ok = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === condoId),
    );
    if (!ok) throw new ForbiddenException('Only management can manage deposits for this condo');
  }

  static prismaError(err: unknown): never {
    if (err instanceof Object && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new BadRequestException('Receipt number collision — retry');
    }
    throw err as Error;
  }
}
