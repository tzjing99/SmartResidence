import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import {
  CastResolutionVoteDto,
  CreateGeneralMeetingDto,
  CreateMeetingResolutionDto,
  ListMeetingsQueryDto,
  OpenResolutionVotingDto,
  PublishMeetingMinutesDto,
  SubmitMeetingProxyDto,
  UpdateGeneralMeetingDto,
  UpdateMeetingResolutionDto,
} from './dto/governance.dto';
import { GovernanceService } from './governance.service';

@ApiTags('Governance')
@ApiBearerAuth('access')
@Controller('governance')
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'GeneralMeeting' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListMeetingsQueryDto,
  ) {
    return this.governance.list(user, condoId, {
      limit: query.limit,
      offset: query.offset,
      manage: query.manage === true,
    });
  }

  @Get(':id/my-proxies')
  @CheckAbility({ action: 'read', subject: 'GeneralMeeting' })
  myProxies(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.governance.getMyProxies(user, id);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'GeneralMeeting' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.governance.getOne(user, id);
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'GeneralMeeting' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'GeneralMeeting',
    resourceIdFrom: 'response.id',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGeneralMeetingDto) {
    return this.governance.create(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'manage', subject: 'GeneralMeeting' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'GeneralMeeting',
    resourceIdFrom: 'params.id',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGeneralMeetingDto,
  ) {
    return this.governance.update(user, id, dto);
  }

  @Post(':id/publish-notice')
  @CheckAbility({ action: 'manage', subject: 'GeneralMeeting' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'GeneralMeeting',
    resourceIdFrom: 'params.id',
  })
  publishNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.governance.publishNotice(user, id);
  }

  @Post(':id/publish-minutes')
  @CheckAbility({ action: 'manage', subject: 'GeneralMeeting' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'GeneralMeeting',
    resourceIdFrom: 'params.id',
  })
  publishMinutes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PublishMeetingMinutesDto,
  ) {
    return this.governance.publishMinutes(user, id, dto);
  }

  @Post(':id/resolutions')
  @CheckAbility({ action: 'manage', subject: 'MeetingResolution' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'MeetingResolution',
    resourceIdFrom: 'response.id',
  })
  addResolution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateMeetingResolutionDto,
  ) {
    return this.governance.addResolution(user, id, dto);
  }

  @Post(':id/proxies')
  @CheckAbility({ action: 'submit-proxy', subject: 'MeetingProxy' })
  submitProxy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmitMeetingProxyDto,
  ) {
    return this.governance.submitProxy(user, id, dto);
  }

  @Patch('resolutions/:id')
  @CheckAbility({ action: 'manage', subject: 'MeetingResolution' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'MeetingResolution',
    resourceIdFrom: 'params.id',
  })
  updateResolution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMeetingResolutionDto,
  ) {
    return this.governance.updateResolution(user, id, dto);
  }

  @Post('resolutions/:id/open-voting')
  @CheckAbility({ action: 'manage', subject: 'MeetingResolution' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'MeetingResolution',
    resourceIdFrom: 'params.id',
  })
  openVoting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: OpenResolutionVotingDto,
  ) {
    return this.governance.openResolutionVoting(user, id, dto);
  }

  @Post('resolutions/:id/close-voting')
  @CheckAbility({ action: 'manage', subject: 'MeetingResolution' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'MeetingResolution',
    resourceIdFrom: 'params.id',
  })
  closeVoting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.governance.closeResolutionVoting(user, id);
  }

  @Get('resolutions/:id/results')
  @CheckAbility({ action: 'read', subject: 'MeetingResolution' })
  results(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.governance.getResolutionResults(user, id);
  }

  @Post('resolutions/:id/vote')
  @CheckAbility({ action: 'vote', subject: 'MeetingResolution' })
  vote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CastResolutionVoteDto,
  ) {
    return this.governance.castResolutionVote(user, id, dto);
  }
}
