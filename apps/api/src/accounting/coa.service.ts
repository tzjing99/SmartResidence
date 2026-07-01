import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { GlAccountType, LedgerFund, Prisma } from '@prisma/client';
import type { GlAccountNode } from '@smartresidence/shared-types';
import { MALAYSIAN_JMB_COA } from './coa-template';

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CoaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensure the default Malaysian JMB chart exists for a condo (idempotent). */
  async ensureSeeded(client: Client, condoId: string): Promise<void> {
    const existing = await client.glAccount.count({ where: { condoId } });
    if (existing > 0) return;

    const idByCode = new Map<string, string>();
    for (const row of MALAYSIAN_JMB_COA) {
      const parentId = row.parentCode ? (idByCode.get(row.parentCode) ?? null) : null;
      const created = await client.glAccount.create({
        data: {
          condoId,
          code: row.code,
          name: row.name,
          type: row.type,
          fund: row.fund,
          parentId,
        },
      });
      idByCode.set(row.code, created.id);
    }
  }

  async listTree(condoId: string): Promise<GlAccountNode[]> {
    await this.ensureSeeded(this.prisma, condoId);
    const rows = await this.prisma.glAccount.findMany({
      where: { condoId },
      orderBy: [{ code: 'asc' }],
    });
    return buildTree(rows);
  }

  async getAccountMap(condoId: string): Promise<Map<string, { id: string; code: string }>> {
    await this.ensureSeeded(this.prisma, condoId);
    const rows = await this.prisma.glAccount.findMany({
      where: { condoId, active: true },
      select: { id: true, code: true },
    });
    return new Map(rows.map((r) => [r.code, r]));
  }

  async createAccount(
    condoId: string,
    input: {
      code: string;
      name: string;
      type: GlAccountType;
      fund: LedgerFund;
      parentId?: string | null;
    },
  ) {
    await this.ensureSeeded(this.prisma, condoId);
    return this.prisma.glAccount.create({
      data: {
        condoId,
        code: input.code.trim(),
        name: input.name.trim(),
        type: input.type,
        fund: input.fund,
        parentId: input.parentId ?? null,
      },
    });
  }

  async updateAccount(
    accountId: string,
    input: { name?: string; active?: boolean; parentId?: string | null },
  ) {
    return this.prisma.glAccount.update({
      where: { id: accountId },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.active != null ? { active: input.active } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      },
    });
  }

  /** Bank (cash) GL accounts suitable for statement import. */
  async listBankAccounts(condoId: string) {
    await this.ensureSeeded(this.prisma, condoId);
    return this.prisma.glAccount.findMany({
      where: { condoId, type: 'ASSET', code: { startsWith: '10' }, active: true },
      orderBy: { code: 'asc' },
    });
  }
}

function buildTree(
  rows: Array<{
    id: string;
    code: string;
    name: string;
    type: GlAccountType;
    fund: LedgerFund;
    parentId: string | null;
    active: boolean;
  }>,
): GlAccountNode[] {
  const byId = new Map<string, GlAccountNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      fund: r.fund,
      parentId: r.parentId,
      active: r.active,
      children: [],
    });
  }
  const roots: GlAccountNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      const parent = byId.get(node.parentId);
      if (parent) parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Sum debits and credits — exported for tests. */
export function journalBalanced(lines: Array<{ debit: number; credit: number }>): boolean {
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(Math.round((debit - credit) * 100) / 100) < 0.005;
}
