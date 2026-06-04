import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';

@ApiTags('Announcements')
@ApiBearerAuth('access')
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Announcement' })
  list(@Param('condoId', new ParseUUIDPipe()) condoId: string, @Query() page: PaginationDto) {
    return this.announcements.list(condoId, page);
  }

  @Post()
  @CheckAbility({ action: 'publish', subject: 'Announcement' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Announcement', resourceIdFrom: 'response.id' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(user, dto);
  }

  @Post(':id/ack')
  @CheckAbility({ action: 'acknowledge', subject: 'Announcement' })
  @Audit({ action: AuditAction.ACK, resourceType: 'Announcement', resourceIdFrom: 'params.id' })
  ack(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.announcements.acknowledge(user, id);
  }
}
