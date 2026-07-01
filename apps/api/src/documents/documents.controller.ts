import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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
import { DocumentsService } from './documents.service';
import {
  CreateDocumentDto,
  CreateDocumentFolderDto,
  ListDocumentFoldersDto,
  ListDocumentsDto,
  PublishDocumentVersionDto,
  UpdateDocumentDto,
  UpdateDocumentFolderDto,
} from './dto/documents.dto';

@ApiTags('Document folders')
@ApiBearerAuth('access')
@Controller('document-folders')
export class DocumentFolderController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'DocumentFolder' })
  @ApiOperation({ summary: 'List document folders for a condo' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListDocumentFoldersDto,
  ) {
    return this.documents.listFolders(user, condoId, query);
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'DocumentFolder' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'DocumentFolder',
    resourceIdFrom: 'response.id',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentFolderDto) {
    return this.documents.createFolder(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'manage', subject: 'DocumentFolder' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'DocumentFolder',
    resourceIdFrom: 'params.id',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDocumentFolderDto,
  ) {
    return this.documents.updateFolder(user, id, dto);
  }

  @Delete(':id')
  @CheckAbility({ action: 'manage', subject: 'DocumentFolder' })
  @Audit({
    action: AuditAction.DELETE,
    resourceType: 'DocumentFolder',
    resourceIdFrom: 'params.id',
  })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documents.deleteFolder(user, id);
  }
}

@ApiTags('Documents')
@ApiBearerAuth('access')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'List documents for a condo (optionally by folder)' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListDocumentsDto,
  ) {
    return this.documents.listDocuments(user, condoId, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Document' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documents.getDocument(user, id);
  }

  @Post()
  @CheckAbility({ action: 'manage', subject: 'Document' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Document', resourceIdFrom: 'response.id' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentDto) {
    return this.documents.createDocument(user, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'manage', subject: 'Document' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Document', resourceIdFrom: 'params.id' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.updateDocument(user, id, dto);
  }

  @Delete(':id')
  @CheckAbility({ action: 'manage', subject: 'Document' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'Document', resourceIdFrom: 'params.id' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documents.deleteDocument(user, id);
  }

  @Get(':id/versions')
  @CheckAbility({ action: 'read', subject: 'DocumentVersion' })
  versions(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documents.listVersions(user, id);
  }

  @Post(':id/versions')
  @CheckAbility({ action: 'manage', subject: 'DocumentVersion' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'DocumentVersion',
    resourceIdFrom: 'response.id',
  })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PublishDocumentVersionDto,
  ) {
    return this.documents.publishVersion(user, id, dto);
  }
}

@ApiTags('Document versions')
@ApiBearerAuth('access')
@Controller('document-versions')
export class DocumentVersionController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':id/download')
  @CheckAbility({ action: 'read', subject: 'DocumentVersion' })
  @ApiOperation({ summary: 'Presigned download URL for a document version' })
  download(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documents.getDownloadUrl(user, id);
  }
}
