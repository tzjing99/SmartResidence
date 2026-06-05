import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditAction } from '@prisma/client';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth('access')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @CheckAbility({ action: 'read', subject: 'AuditLog' })
  @ApiOperation({ summary: 'Query the audit log (management / super admin)' })
  query(
    @Query() page: PaginationDto,
    @Query('unitId') unitId?: string,
    @Query('condoId') condoId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: AuditAction,
  ) {
    return this.audit.query({ ...page, unitId, condoId, resourceType, actorUserId, action });
  }

  @Get('me/activity')
  @ApiOperation({
    summary: 'Activity feed for owner empowerment — every action on the user\u2019s units',
  })
  ownerActivity(@CurrentUser() user: AuthenticatedUser, @Query() page: PaginationDto) {
    return this.audit.forOwnerActivityFeed(user, page);
  }

  @Get('me/who-viewed')
  @ApiOperation({
    summary: 'Who looked at my data — list of management reads on the user\u2019s resources',
  })
  whoViewed(@CurrentUser() user: AuthenticatedUser, @Query() page: PaginationDto) {
    return this.audit.whoViewedMyData(user, page);
  }
}
