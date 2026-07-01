import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CastPollVoteDto, CreatePollDto, ListPollsQueryDto, UpdatePollDto } from './dto/polls.dto';
import { PollsService } from './polls.service';

@ApiTags('Polls')
@ApiBearerAuth('access')
@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Poll' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListPollsQueryDto,
  ) {
    return this.polls.list(user, condoId, {
      limit: query.limit,
      offset: query.offset,
      manage: query.manage === true,
    });
  }

  @Get(':id/my-votes')
  @CheckAbility({ action: 'read', subject: 'Poll' })
  myVotes(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.polls.getMyVotes(user, id);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Poll' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.polls.getOne(user, id);
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'Poll' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Poll', resourceIdFrom: 'response.id' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePollDto) {
    return this.polls.create(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'manage', subject: 'Poll' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Poll', resourceIdFrom: 'params.id' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePollDto,
  ) {
    return this.polls.update(user, id, dto);
  }

  @Post(':id/vote')
  @CheckAbility({ action: 'vote', subject: 'Poll' })
  vote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CastPollVoteDto,
  ) {
    return this.polls.castVote(user, id, dto);
  }
}
