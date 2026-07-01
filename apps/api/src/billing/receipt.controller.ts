import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ReceiptKind } from '@prisma/client';
import type { Response } from 'express';
import { ReceiptService } from './receipt.service';

@ApiTags('Receipts')
@ApiBearerAuth('access')
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Receipt' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() page: PaginationDto,
    @Query('kind') kind?: ReceiptKind,
  ) {
    return this.receipts.listForCondo(user, condoId, { ...page, kind });
  }

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Receipt' })
  forUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query() page: PaginationDto,
  ) {
    return this.receipts.listForUnit(user, unitId, page);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Receipt' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.receipts.get(user, id);
  }

  @Get(':id/pdf')
  @CheckAbility({ action: 'read', subject: 'Receipt' })
  @ApiOperation({ summary: 'Download the official receipt PDF' })
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.receipts.getPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
