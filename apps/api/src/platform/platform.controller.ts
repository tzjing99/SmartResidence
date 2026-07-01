import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListPlatformCondosQueryDto } from './dto/platform.dto';
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
    return this.platform.listCondos(user, { search: query.search });
  }

  @Get(':id/summary')
  @CheckAbility({ action: 'read', subject: 'Platform' })
  @ApiOperation({ summary: 'Drill-down health and setup summary for one condo' })
  getSummary(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.platform.getCondoSummary(user, id);
  }
}
