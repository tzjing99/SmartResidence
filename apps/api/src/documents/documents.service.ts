import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/storage/storage.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttachmentOwner,
  AttachmentStatus,
  AuditAction,
  DocumentFolderAudience,
  type Prisma,
  RoleId,
} from '@prisma/client';
import { isAllowedDocumentMime } from '@smartresidence/shared-types';
import type {
  CreateDocumentDto,
  CreateDocumentFolderDto,
  PublishDocumentVersionDto,
  UpdateDocumentDto,
  UpdateDocumentFolderDto,
} from './dto/documents.dto';

const folderInclude = {
  _count: { select: { documents: true } },
} satisfies Prisma.DocumentFolderInclude;

const documentInclude = {
  folder: { select: { id: true, name: true, audience: true } },
  currentVersion: {
    select: {
      id: true,
      versionNumber: true,
      mimeType: true,
      sizeBytes: true,
      publishedAt: true,
      notes: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.DocumentInclude;

const versionInclude = {
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.DocumentVersionInclude;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  async listFolders(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { includeInactive?: boolean },
  ) {
    this.assertCondoAccess(actor, condoId);
    const manage = this.isManagement(actor, condoId);
    const audiences = this.visibleAudiences(actor, condoId);

    const rows = await this.prisma.documentFolder.findMany({
      where: {
        condoId,
        ...(manage && opts.includeInactive ? {} : { active: true }),
        ...(manage ? {} : { audience: { in: audiences } }),
      },
      include: folderInclude,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    return rows;
  }

  async createFolder(actor: AuthenticatedUser, dto: CreateDocumentFolderDto) {
    this.assertManagement(actor, dto.condoId);
    const created = await this.prisma.documentFolder.create({
      data: {
        condoId: dto.condoId,
        name: dto.name.trim(),
        audience: dto.audience ?? DocumentFolderAudience.ALL,
        position: dto.position ?? 0,
      },
      include: folderInclude,
    });
    await this.audit(actor, dto.condoId, AuditAction.CREATE, 'DocumentFolder', created.id);
    return created;
  }

  async updateFolder(actor: AuthenticatedUser, id: string, dto: UpdateDocumentFolderDto) {
    const existing = await this.prisma.documentFolder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Folder not found');
    this.assertManagement(actor, existing.condoId);

    const updated = await this.prisma.documentFolder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: folderInclude,
    });
    await this.audit(actor, existing.condoId, AuditAction.UPDATE, 'DocumentFolder', id);
    return updated;
  }

  async deleteFolder(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.documentFolder.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
    if (!existing) throw new NotFoundException('Folder not found');
    this.assertManagement(actor, existing.condoId);

    if (existing._count.documents > 0) {
      await this.prisma.documentFolder.update({
        where: { id },
        data: { active: false },
      });
      await this.audit(actor, existing.condoId, AuditAction.UPDATE, 'DocumentFolder', id, {
        deactivated: true,
      });
      return { ok: true, deactivated: true };
    }

    await this.prisma.documentFolder.delete({ where: { id } });
    await this.audit(actor, existing.condoId, AuditAction.DELETE, 'DocumentFolder', id);
    return { ok: true };
  }

  async listDocuments(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { folderId?: string; includeInactive?: boolean; limit: number; offset: number },
  ) {
    this.assertCondoAccess(actor, condoId);
    const manage = this.isManagement(actor, condoId);
    const audiences = this.visibleAudiences(actor, condoId);
    const where = {
      condoId,
      ...(opts.folderId ? { folderId: opts.folderId } : {}),
      ...(manage && opts.includeInactive ? {} : { active: true }),
      folder: manage ? undefined : { audience: { in: audiences }, active: true },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: documentInclude,
        orderBy: [{ title: 'asc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.document.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getDocument(actor: AuthenticatedUser, id: string) {
    const row = await this.prisma.document.findUnique({
      where: { id },
      include: documentInclude,
    });
    if (!row || (!row.active && !this.isManagement(actor, row.condoId))) {
      throw new NotFoundException('Document not found');
    }
    this.assertCanReadFolder(actor, row.condoId, row.folder.audience);
    return row;
  }

  async createDocument(actor: AuthenticatedUser, dto: CreateDocumentDto) {
    const folder = await this.prisma.documentFolder.findUnique({ where: { id: dto.folderId } });
    if (!folder || !folder.active) throw new NotFoundException('Folder not found');
    this.assertManagement(actor, folder.condoId);

    const created = await this.prisma.document.create({
      data: {
        folderId: folder.id,
        condoId: folder.condoId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
      },
      include: documentInclude,
    });
    await this.audit(actor, folder.condoId, AuditAction.CREATE, 'Document', created.id);
    return created;
  }

  async updateDocument(actor: AuthenticatedUser, id: string, dto: UpdateDocumentDto) {
    const existing = await this.prisma.document.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Document not found');
    this.assertManagement(actor, existing.condoId);

    if (dto.folderId) {
      const folder = await this.prisma.documentFolder.findUnique({ where: { id: dto.folderId } });
      if (!folder || folder.condoId !== existing.condoId) {
        throw new BadRequestException('Target folder not found in this condo');
      }
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: documentInclude,
    });
    await this.audit(actor, existing.condoId, AuditAction.UPDATE, 'Document', id);
    return updated;
  }

  async deleteDocument(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.document.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Document not found');
    this.assertManagement(actor, existing.condoId);
    await this.prisma.document.update({ where: { id }, data: { active: false } });
    await this.audit(actor, existing.condoId, AuditAction.UPDATE, 'Document', id, {
      deactivated: true,
    });
    return { ok: true };
  }

  async listVersions(actor: AuthenticatedUser, documentId: string) {
    const doc = await this.getDocument(actor, documentId);
    return this.prisma.documentVersion.findMany({
      where: { documentId: doc.id },
      include: versionInclude,
      orderBy: { versionNumber: 'desc' },
    });
  }

  async publishVersion(
    actor: AuthenticatedUser,
    documentId: string,
    dto: PublishDocumentVersionDto,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { folder: true },
    });
    if (!doc || !doc.active) throw new NotFoundException('Document not found');
    this.assertManagement(actor, doc.condoId);

    const attachment = await this.prisma.attachment.findUnique({ where: { id: dto.attachmentId } });
    if (!attachment) throw new BadRequestException('Attachment not found');
    if (attachment.uploadedByUserId !== actor.id) {
      throw new ForbiddenException('Attachment was uploaded by another user');
    }
    if (
      attachment.status !== AttachmentStatus.PENDING ||
      attachment.ownerKind !== AttachmentOwner.GENERIC
    ) {
      throw new BadRequestException('Attachment is not available for publishing');
    }
    if (!isAllowedDocumentMime(attachment.mimeType)) {
      throw new BadRequestException('Only PDF documents can be published');
    }

    const latest = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const publishedAt = new Date();

    const version = await this.prisma.$transaction(async (tx) => {
      const created = await tx.documentVersion.create({
        data: {
          documentId,
          versionNumber,
          fileKey: attachment.key,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
          uploadedByUserId: actor.id,
          publishedAt,
          notes: dto.notes?.trim() || null,
        },
        include: versionInclude,
      });

      await tx.attachment.update({
        where: { id: attachment.id },
        data: {
          status: AttachmentStatus.COMMITTED,
          ownerKind: AttachmentOwner.DOCUMENT_VERSION,
          documentVersionId: created.id,
        },
      });

      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: created.id },
      });

      return created;
    });

    await this.audit(actor, doc.condoId, AuditAction.CREATE, 'DocumentVersion', version.id, {
      documentId,
      versionNumber,
    });

    this.events.emit('document.version.published', {
      documentId,
      versionId: version.id,
      condoId: doc.condoId,
      folderAudience: doc.folder.audience,
      title: doc.title,
    });

    return version;
  }

  async getDownloadUrl(actor: AuthenticatedUser, versionId: string) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: {
        document: { include: { folder: { select: { audience: true } } } },
      },
    });
    if (!version) throw new NotFoundException('Version not found');
    const doc = version.document;
    if (!doc.active && !this.isManagement(actor, doc.condoId)) {
      throw new NotFoundException('Version not found');
    }
    this.assertCanReadFolder(actor, doc.condoId, doc.folder.audience);

    const expiresIn = 60 * 5;
    const url = await this.storage.presignDownload(version.fileKey, expiresIn);
    const meta = await this.prisma.attachment.findFirst({
      where: { documentVersionId: versionId },
      select: { metadata: true },
    });
    const fileName =
      typeof (meta?.metadata as { fileName?: unknown } | null)?.fileName === 'string'
        ? ((meta?.metadata as { fileName: string }).fileName ?? `${doc.title}.pdf`)
        : `${doc.title}.pdf`;

    return { url, expiresIn, fileName, mimeType: version.mimeType, sizeBytes: version.sizeBytes };
  }

  private visibleAudiences(actor: AuthenticatedUser, condoId: string): DocumentFolderAudience[] {
    if (this.isManagement(actor, condoId)) {
      return [
        DocumentFolderAudience.ALL,
        DocumentFolderAudience.OWNERS,
        DocumentFolderAudience.MANAGEMENT,
      ];
    }
    const isOwner = actor.roles.some(
      (r) => r.roleId === RoleId.UNIT_OWNER && r.condoId === condoId,
    );
    const audiences: DocumentFolderAudience[] = [DocumentFolderAudience.ALL];
    if (isOwner) audiences.push(DocumentFolderAudience.OWNERS);
    return audiences;
  }

  private assertCanReadFolder(
    actor: AuthenticatedUser,
    condoId: string,
    audience: DocumentFolderAudience,
  ) {
    this.assertCondoAccess(actor, condoId);
    if (this.isManagement(actor, condoId)) return;
    const allowed = this.visibleAudiences(actor, condoId);
    if (!allowed.includes(audience)) {
      throw new ForbiddenException('You do not have access to this folder');
    }
  }

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
  }

  private assertManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isManagement(user, condoId)) {
      throw new ForbiddenException('Management access required');
    }
  }

  private assertCondoAccess(user: AuthenticatedUser, condoId: string) {
    const ok = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId);
    if (!ok) throw new ForbiddenException('No access to this condo');
  }

  private async audit(
    actor: AuthenticatedUser,
    condoId: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        condoId,
        actorUserId: actor.id,
        action,
        resourceType,
        resourceId,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
