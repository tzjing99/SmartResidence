import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CreateLostFoundPostDto, ListLostFoundPostsDto } from './dto/lost-found.dto';
import { LostFoundService } from './lost-found.service';

@ApiTags('Lost & found')
@ApiBearerAuth('access')
@Controller('lost-found')
export class LostFoundController {
  constructor(private readonly lostFound: LostFoundService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'LostFoundPost' })
  @ApiOperation({ summary: 'List lost & found posts for a condo' })
  listForCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListLostFoundPostsDto,
  ) {
    return this.lostFound.listForCondo(user, condoId, query);
  }

  @Get('mine')
  @CheckAbility({ action: 'read', subject: 'LostFoundPost' })
  @ApiOperation({ summary: 'List your own lost & found posts' })
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: ListLostFoundPostsDto) {
    return this.lostFound.listMine(user, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'LostFoundPost' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.lostFound.getOne(user, id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'LostFoundPost' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'LostFoundPost',
    resourceIdFrom: 'response.id',
  })
  @ApiOperation({ summary: 'Post a lost or found item to the condo board' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLostFoundPostDto) {
    return this.lostFound.create(user, dto);
  }

  @Post(':id/resolve')
  @CheckAbility({ action: 'resolve', subject: 'LostFoundPost' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'LostFoundPost', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Mark a post as resolved (owner or management)' })
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.lostFound.resolve(user, id);
  }

  @Post(':id/remove')
  @CheckAbility({ action: 'delete', subject: 'LostFoundPost' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'LostFoundPost', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Remove your own post from the board' })
  removeOwn(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.lostFound.removeOwn(user, id);
  }

  @Post(':id/moderate-remove')
  @CheckAbility({ action: 'manage', subject: 'LostFoundPost' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'LostFoundPost', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Management removes a post from the board' })
  moderateRemove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.lostFound.moderateRemove(user, id);
  }
}
