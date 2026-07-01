import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import {
  CreateFormSubmissionDto,
  CreateFormTemplateDto,
  ListFormSubmissionsDto,
  ListFormTemplatesDto,
  RejectFormSubmissionDto,
  UpdateFormSubmissionDto,
  UpdateFormTemplateDto,
} from './dto/forms.dto';
import { FormsService } from './forms.service';

@ApiTags('Form templates')
@ApiBearerAuth('access')
@Controller('form-templates')
export class FormTemplateController {
  constructor(private readonly forms: FormsService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'FormTemplate' })
  @ApiOperation({ summary: 'List available form templates for a condo' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListFormTemplatesDto,
  ) {
    return this.forms.listTemplates(user, condoId, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'FormTemplate' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.forms.getTemplate(user, id);
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'FormTemplate' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'FormTemplate',
    resourceIdFrom: 'response.id',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFormTemplateDto) {
    return this.forms.createTemplate(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'manage', subject: 'FormTemplate' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'FormTemplate', resourceIdFrom: 'params.id' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFormTemplateDto,
  ) {
    return this.forms.updateTemplate(user, id, dto);
  }

  @Delete(':id')
  @CheckAbility({ action: 'manage', subject: 'FormTemplate' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'FormTemplate', resourceIdFrom: 'params.id' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.forms.deleteTemplate(user, id);
  }
}

@ApiTags('Form submissions')
@ApiBearerAuth('access')
@Controller('form-submissions')
export class FormSubmissionController {
  constructor(private readonly forms: FormsService) {}

  @Get('mine')
  @CheckAbility({ action: 'read', subject: 'FormSubmission' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() page: PaginationDto) {
    return this.forms.listMine(user, page);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'FormSubmission' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListFormSubmissionsDto,
  ) {
    return this.forms.listSubmissionsForCondo(user, condoId, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'FormSubmission' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.forms.getSubmission(user, id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'FormSubmission' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'FormSubmission',
    resourceIdFrom: 'response.id',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFormSubmissionDto) {
    return this.forms.createSubmission(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'FormSubmission' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'FormSubmission',
    resourceIdFrom: 'params.id',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFormSubmissionDto,
  ) {
    return this.forms.updateSubmission(user, id, dto);
  }

  @Post(':id/cancel')
  @CheckAbility({ action: 'cancel', subject: 'FormSubmission' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'FormSubmission',
    resourceIdFrom: 'params.id',
  })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.forms.cancelSubmission(user, id);
  }

  @Post(':id/approve')
  @CheckAbility({ action: 'approve', subject: 'FormSubmission' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'FormSubmission',
    resourceIdFrom: 'params.id',
  })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.forms.approveSubmission(user, id);
  }

  @Post(':id/reject')
  @CheckAbility({ action: 'reject', subject: 'FormSubmission' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'FormSubmission',
    resourceIdFrom: 'params.id',
  })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectFormSubmissionDto,
  ) {
    return this.forms.rejectSubmission(user, id, dto);
  }
}
