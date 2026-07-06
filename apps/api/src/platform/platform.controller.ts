import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePlatformCondoDto, ListPlatformCondosQueryDto } from './dto/platform.dto';
import { PlatformService } from './platform.service';

@ApiTags('Platform')
@ApiBearerAuth('access')
@Controller('platform/condos')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Platform' })
  @ApiOperation({ summary: 'List all condos with health summary (platform operators)' })
  listCondos(@CurrentUser() user: AuthenticatedUser, @Query() query: ListPlatformCondosQueryDto) {
    return this.platform.listCondos(user, {
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'Platform' })
  @ApiOperation({ summary: 'Provision a new condo (super-admin only)' })
  provisionCondo(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlatformCondoDto) {
    return this.platform.provisionCondo(user, dto);
  }

  @Get(':id/summary')
  @CheckAbility({ action: 'read', subject: 'Platform' })
  @ApiOperation({ summary: 'Drill-down health and setup summary for one condo' })
  getSummary(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.platform.getCondoSummary(user, id);
  }

  @Get(':id/health')
  @CheckAbility({ action: 'read', subject: 'Platform' })
  @ApiOperation({ summary: 'Condo health dashboard for platform operators' })
  getHealth(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.platform.getCondoHealth(user, id);
  }
}
