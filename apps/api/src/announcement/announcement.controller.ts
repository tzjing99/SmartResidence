import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { AnnouncementService } from './announcement.service';
import {
  CreateAnnouncementDto,
  ListAnnouncementsDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@ApiTags('Announcements')
@ApiBearerAuth('access')
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get('condo/:condoId/manage')
  @CheckAbility({ action: 'publish', subject: 'Announcement' })
  manage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListAnnouncementsDto,
  ) {
    return this.announcements.manage(user, condoId, query);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Announcement' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListAnnouncementsDto,
  ) {
    return this.announcements.list(user, condoId, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Announcement' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.announcements.getOne(user, id);
  }

  @Post()
  @CheckAbility({ action: 'publish', subject: 'Announcement' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'Announcement',
    resourceIdFrom: 'response.id',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'publish', subject: 'Announcement' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Announcement', resourceIdFrom: 'params.id' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcements.update(user, id, dto);
  }

  @Delete(':id')
  @CheckAbility({ action: 'publish', subject: 'Announcement' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'Announcement', resourceIdFrom: 'params.id' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.announcements.softDelete(user, id);
  }

  @Post(':id/ack')
  @CheckAbility({ action: 'acknowledge', subject: 'Announcement' })
  @Audit({ action: AuditAction.ACK, resourceType: 'Announcement', resourceIdFrom: 'params.id' })
  ack(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.announcements.acknowledge(user, id);
  }

  @Post(':id/read')
  @CheckAbility({ action: 'read', subject: 'Announcement' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.announcements.markRead(user, id);
  }
}
