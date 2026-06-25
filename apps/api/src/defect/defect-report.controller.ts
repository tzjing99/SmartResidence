import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import type { Response } from 'express';
import { DefectReportService } from './defect-report.service';
import { BulkUpdateReportItemsDto, CreateHandoverReportDto } from './dto/defect-report.dto';

@ApiTags('Defect reports')
@ApiBearerAuth('access')
@Controller('defects/reports')
export class DefectReportController {
  constructor(private readonly reports: DefectReportService) {}

  @Post()
  @CheckAbility({ action: 'create', subject: 'DefectReport' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'DefectReport',
    resourceIdFrom: 'response.id',
  })
  @ApiOperation({ summary: 'Submit a handover inspection (parent report + N defect items)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHandoverReportDto) {
    return this.reports.createHandover(user, dto);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'DefectReport' })
  @ApiOperation({ summary: 'List handover reports for a condo (FIFO)' })
  listForCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.reports.listForCondo(user, condoId);
  }

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'DefectReport' })
  @ApiOperation({ summary: 'List multi-defect packages for one unit' })
  listForUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
  ) {
    return this.reports.listForUnit(user, unitId);
  }

  @Get(':id/export.pdf')
  @CheckAbility({ action: 'read', subject: 'DefectReport' })
  @ApiOperation({ summary: 'Export a handover report as a contractor PDF (management only)' })
  async exportPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reports.exportPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'DefectReport' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reports.getOne(user, id);
  }

  @Patch(':id/items')
  @CheckAbility({ action: 'update', subject: 'DefectReport' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'DefectReport', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Bulk assign / transition report line items' })
  bulkUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BulkUpdateReportItemsDto,
  ) {
    return this.reports.bulkUpdateItems(id, user, dto);
  }
}
