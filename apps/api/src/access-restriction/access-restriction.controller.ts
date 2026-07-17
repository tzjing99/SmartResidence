import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccessRestrictionService } from './access-restriction.service';
import {
  ManualRestrictDto,
  UpdateAccessRestrictionSettingsDto,
} from './dto/access-restriction.dto';

@ApiTags('Access restriction')
@ApiBearerAuth('access')
@Controller('access-restriction')
export class AccessRestrictionController {
  constructor(private readonly access: AccessRestrictionService) {}

  @Get('condo/:condoId/settings')
  @CheckAbility({ action: 'manage', subject: 'AccessRestriction' })
  @ApiOperation({ summary: 'Get arrears access-restriction policy' })
  getSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.access.getSettings(user, condoId);
  }

  @Patch('condo/:condoId/settings')
  @CheckAbility({ action: 'manage', subject: 'AccessRestriction' })
  @ApiOperation({ summary: 'Update arrears access-restriction policy' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateAccessRestrictionSettingsDto,
  ) {
    return this.access.updateSettings(user, condoId, dto);
  }

  @Get('condo/:condoId/units')
  @CheckAbility({ action: 'manage', subject: 'AccessRestriction' })
  @ApiOperation({ summary: 'List unit access restrictions' })
  listUnits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.access.listUnits(user, condoId);
  }

  @Post('condo/:condoId/units/:unitId/restrict')
  @CheckAbility({ action: 'manage', subject: 'AccessRestriction' })
  @ApiOperation({ summary: 'Manually restrict a unit' })
  restrict(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Body() dto: ManualRestrictDto,
  ) {
    return this.access.forceRestrict(user, condoId, unitId, dto.reason);
  }

  @Post('condo/:condoId/units/:unitId/clear')
  @CheckAbility({ action: 'manage', subject: 'AccessRestriction' })
  @ApiOperation({ summary: 'Manually clear / exempt a unit' })
  clear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
  ) {
    return this.access.forceClear(user, condoId, unitId);
  }

  @Post('condo/:condoId/recompute')
  @CheckAbility({ action: 'manage', subject: 'AccessRestriction' })
  @ApiOperation({ summary: 'Re-run auto arrears access engine' })
  recompute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.access.recomputeForUser(user, condoId);
  }

  @Get('condo/:condoId/export.json')
  @CheckAbility({ action: 'export', subject: 'AccessRestriction' })
  @ApiOperation({ summary: 'JSON export for ZKTeco/MAG integrators' })
  exportJson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.access.exportJson(user, condoId);
  }

  @Get('condo/:condoId/export.csv')
  @CheckAbility({ action: 'export', subject: 'AccessRestriction' })
  @Header('content-type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'CSV export for ZKTeco/MAG integrators' })
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Res() res: Response,
  ) {
    const csv = await this.access.exportCsv(user, condoId);
    res.setHeader(
      'content-disposition',
      `attachment; filename="access-restrictions-${condoId.slice(0, 8)}.csv"`,
    );
    res.send(csv);
  }
}
