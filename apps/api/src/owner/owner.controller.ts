import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleId } from '@prisma/client';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Owner-empowerment endpoints: surfaces meant for unit owners to see and
 * control delegated access on the units they own. Read-only here; the
 * actual revoke action lives on the auth controller.
 */
@ApiTags('Owner')
@Controller('owner')
@UseGuards(AuthGuard)
@ApiBearerAuth('access')
export class OwnerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('delegated-access')
  @ApiOperation({
    summary: 'All delegated role grants on units this user owns.',
  })
  async listDelegatedAccess(@CurrentUser() user: AuthenticatedUser) {
    const ownedUnitIds = user.roles
      .filter((r) => r.roleId === RoleId.UNIT_OWNER && r.unitId)
      .map((r) => r.unitId!) as string[];
    if (ownedUnitIds.length === 0) return [];

    return this.prisma.roleAssignment.findMany({
      where: {
        unitId: { in: ownedUnitIds },
        revokedAt: null,
        // Owners themselves are excluded — only delegated/derivative roles.
        roleId: { in: [RoleId.TENANT, RoleId.HOUSEHOLD_MEMBER, RoleId.CONTRACTOR] },
      },
      select: {
        id: true,
        roleId: true,
        unitId: true,
        expiresAt: true,
        grantedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }
}
