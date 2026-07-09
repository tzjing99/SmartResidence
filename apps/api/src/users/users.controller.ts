import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import type { Response } from 'express';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UserAccountDeletionService } from './user-account-deletion.service';
import { UserDataExportService } from './user-data-export.service';

@ApiTags('Users')
@ApiBearerAuth('access')
@Controller('users')
export class UsersController {
  constructor(
    private readonly exports: UserDataExportService,
    private readonly deletions: UserAccountDeletionService,
  ) {}

  @Post('me/export')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'export', subject: 'User' })
  @Audit({ action: AuditAction.EXPORT, resourceType: 'User', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Request a PDPA personal data export (JSON bundle)' })
  requestExport(@CurrentUser() user: AuthenticatedUser) {
    return this.exports.createExport(user).then((meta) => ({
      id: user.id,
      exportId: meta.id,
      status: meta.status,
      createdAt: meta.createdAt,
      expiresAt: meta.expiresAt,
    }));
  }

  @Get('me/export/:id')
  @CheckAbility({ action: 'export', subject: 'User' })
  @ApiOperation({ summary: 'Download a completed personal data export' })
  async downloadExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const bundle = await this.exports.getExport(user, id);
    const filename = `smartresidence-data-export-${id.slice(0, 8)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(bundle, null, 2));
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @CheckAbility({ action: 'delete', subject: 'User' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'User', resourceIdFrom: 'response.id' })
  @ApiOperation({
    summary: 'Delete / anonymize the current account (PDPA erasure). Requires confirmation phrase.',
  })
  deleteAccount(@CurrentUser() user: AuthenticatedUser, @Body() _dto: DeleteAccountDto) {
    return this.deletions.deleteAccount(user);
  }
}
