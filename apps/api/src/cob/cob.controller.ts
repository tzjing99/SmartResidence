import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CobService } from './cob.service';

@ApiTags('COB compliance')
@ApiBearerAuth('access')
@Controller('cob')
export class CobController {
  constructor(private readonly cob: CobService) {}

  @Get('condo/:condoId/templates')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'List COB form templates and pre-fill snapshot for a condo' })
  listTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cob.listTemplates(user, condoId, from, to);
  }

  @Get('condo/:condoId/templates/:kind')
  @CheckAbility({ action: 'read', subject: 'Ledger' })
  @ApiOperation({ summary: 'Download a pre-filled COB form PDF (kind may include .pdf suffix)' })
  async downloadTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('kind') kind: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.cob.generatePdf(user, condoId, kind, from, to);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
