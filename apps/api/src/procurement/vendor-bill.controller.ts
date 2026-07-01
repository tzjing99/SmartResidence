import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import type { Response } from 'express';
import {
  CreateVendorBillDto,
  ListVendorBillsDto,
  UpdateVendorBillDto,
  VendorSpendReportQueryDto,
} from './dto/vendor-bill.dto';
import { VendorBillExportsService } from './vendor-bill-exports.service';
import { VendorBillService } from './vendor-bill.service';

@ApiTags('Procurement — vendor bills')
@ApiBearerAuth('access')
@Controller('procurement/bills')
export class VendorBillController {
  constructor(
    private readonly bills: VendorBillService,
    private readonly exports: VendorBillExportsService,
  ) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'VendorBill' })
  @ApiOperation({ summary: 'List vendor bills for a condo' })
  listForCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListVendorBillsDto,
  ) {
    return this.bills.listForCondo(user, condoId, query);
  }

  @Get('condo/:condoId/spend-by-fund.csv')
  @CheckAbility({ action: 'export', subject: 'VendorBill' })
  @ApiOperation({ summary: 'Vendor spend by fund CSV for AGM' })
  async spendByFundCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: VendorSpendReportQueryDto,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.exports.vendorSpendByFundCsv(
      user,
      condoId,
      query.from,
      query.to,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'VendorBill' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bills.getOne(user, id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'VendorBill' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'VendorBill', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Create a vendor bill (draft)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorBillDto) {
    return this.bills.create(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'VendorBill' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'VendorBill', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Update a draft vendor bill' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVendorBillDto,
  ) {
    return this.bills.update(user, id, dto);
  }

  @Post(':id/approve')
  @CheckAbility({ action: 'approve', subject: 'VendorBill' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'VendorBill', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Approve a draft vendor bill' })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bills.approve(user, id);
  }

  @Post(':id/pay')
  @CheckAbility({ action: 'pay', subject: 'VendorBill' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'VendorBill', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Mark an approved vendor bill as paid (manual payment)' })
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bills.markPaid(user, id);
  }

  @Post(':id/void')
  @CheckAbility({ action: 'delete', subject: 'VendorBill' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'VendorBill', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Void a draft or approved vendor bill' })
  voidBill(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bills.voidBill(user, id);
  }
}
