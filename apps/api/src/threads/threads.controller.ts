import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import {
  AppealThreadDto,
  ConfirmResolutionDto,
  CreateThreadDto,
  ListThreadsDto,
  PostMessageDto,
  ProposeResolutionDto,
  RequestResidentDto,
  UpdateThreadDto,
} from './dto/thread.dto';
import { ThreadsService } from './threads.service';

@ApiTags('Threads')
@ApiBearerAuth('access')
@Controller('threads')
export class ThreadsController {
  constructor(private readonly threads: ThreadsService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Thread' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListThreadsDto) {
    return this.threads.list(user, query);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'Thread' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Thread', resourceIdFrom: 'response.id' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateThreadDto) {
    return this.threads.create(user, dto);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Thread' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.threads.getOne(user, id);
  }

  @Post(':id/messages')
  @CheckAbility({ action: 'create', subject: 'ThreadMessage' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'ThreadMessage',
    resourceIdFrom: 'response.id',
  })
  postMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.threads.postMessage(user, id, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'Thread' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.threads.update(user, id, dto);
  }

  @Post(':id/propose-resolution')
  @CheckAbility({ action: 'update', subject: 'Thread' })
  proposeResolution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ProposeResolutionDto,
  ) {
    return this.threads.proposeResolution(user, id, dto);
  }

  @Post(':id/confirm-resolution')
  @CheckAbility({ action: 'resolve', subject: 'Thread' })
  confirmResolution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmResolutionDto,
  ) {
    return this.threads.confirmResolution(user, id, dto);
  }

  @Post(':id/request-resident')
  @CheckAbility({ action: 'update', subject: 'Thread' })
  requestResident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RequestResidentDto,
  ) {
    return this.threads.requestResident(user, id, dto);
  }

  @Post(':id/appeal')
  @CheckAbility({ action: 'resolve', subject: 'Thread' })
  appeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AppealThreadDto,
  ) {
    return this.threads.appeal(user, id, dto);
  }

  @Post(':id/read')
  @CheckAbility({ action: 'read', subject: 'Thread' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.threads.markRead(user, id);
  }
}
