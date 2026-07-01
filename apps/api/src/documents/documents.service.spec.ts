import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import type { StorageService } from '@/storage/storage.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { AttachmentOwner, AttachmentStatus, DocumentFolderAudience, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsService } from './documents.service';

const CONDO = 'condo-1';
const FOLDER_ID = 'folder-1';
const DOC_ID = 'doc-1';

const FOLDER = {
  id: FOLDER_ID,
  condoId: CONDO,
  name: 'House rules',
  audience: DocumentFolderAudience.ALL,
  position: 0,
  active: true,
};

function owner(): AuthenticatedUser {
  return {
    id: 'owner-1',
    email: 'o@b.c',
    name: 'Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: 'unit-1', permissions: [] }],
  };
}

function tenant(): AuthenticatedUser {
  return {
    id: 'tenant-1',
    email: 't@b.c',
    name: 'Tenant',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.TENANT,
    roles: [{ roleId: RoleId.TENANT, condoId: CONDO, unitId: 'unit-1', permissions: [] }],
  };
}

function manager(): AuthenticatedUser {
  return {
    id: 'mgr-1',
    email: 'm@b.c',
    name: 'Manager',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

function makeService() {
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  const storage = {
    presignDownload: vi.fn(async () => 'https://example.com/file.pdf'),
  } as unknown as StorageService;

  const prisma = {
    documentFolder: {
      findMany: vi.fn(async () => [FOLDER]),
      findUnique: vi.fn(async () => FOLDER),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: FOLDER_ID,
        ...args.data,
        _count: { documents: 0 },
      })),
      update: vi.fn(async () => FOLDER),
      delete: vi.fn(async () => FOLDER),
    },
    document: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => ({
        id: DOC_ID,
        condoId: CONDO,
        folderId: FOLDER_ID,
        title: 'Bylaws',
        active: true,
        folder: FOLDER,
        currentVersion: null,
      })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: DOC_ID,
        ...args.data,
        folder: FOLDER,
        currentVersion: null,
      })),
      update: vi.fn(async () => ({ id: DOC_ID })),
    },
    documentVersion: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'ver-1',
        ...args.data,
        uploadedBy: { id: 'mgr-1', name: 'Manager' },
      })),
    },
    attachment: {
      findUnique: vi.fn(async () => ({
        id: 'att-1',
        key: 'uploads/mgr/file.pdf',
        mimeType: 'application/pdf',
        size: 1234,
        status: AttachmentStatus.PENDING,
        ownerKind: AttachmentOwner.GENERIC,
        uploadedByUserId: 'mgr-1',
      })),
      findFirst: vi.fn(async () => ({ metadata: { fileName: 'bylaws.pdf' } })),
      update: vi.fn(async () => ({})),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  const service = new DocumentsService(prisma, storage, events);
  return { service, prisma, events, storage };
}

describe('DocumentsService', () => {
  it('filters owner-only folders from tenants', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.documentFolder.findMany).mockImplementation(async (args) => {
      const where = args?.where as { audience?: { in?: DocumentFolderAudience[] } };
      expect(where.audience?.in).toEqual([DocumentFolderAudience.ALL]);
      return [];
    });
    await service.listFolders(tenant(), CONDO, {});
  });

  it('includes owner audience for unit owners', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.documentFolder.findMany).mockImplementation(async (args) => {
      const where = args?.where as { audience?: { in?: DocumentFolderAudience[] } };
      expect(where.audience?.in).toContain(DocumentFolderAudience.OWNERS);
      return [];
    });
    await service.listFolders(owner(), CONDO, {});
  });

  it('blocks residents from owner-only folders', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: DOC_ID,
      condoId: CONDO,
      folderId: FOLDER_ID,
      title: 'MC minutes',
      active: true,
      folder: { ...FOLDER, audience: DocumentFolderAudience.OWNERS },
      currentVersion: null,
    } as never);
    await expect(service.getDocument(tenant(), DOC_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publishes a new version from a pending attachment', async () => {
    const { service, prisma, events } = makeService();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: DOC_ID,
      condoId: CONDO,
      active: true,
      title: 'Bylaws',
      folder: FOLDER,
    } as never);

    const version = await service.publishVersion(manager(), DOC_ID, { attachmentId: 'att-1' });
    expect(version.versionNumber).toBe(1);
    expect(events.emit).toHaveBeenCalledWith(
      'document.version.published',
      expect.objectContaining({ documentId: DOC_ID, condoId: CONDO }),
    );
  });

  it('rejects publish when document missing', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);
    await expect(
      service.publishVersion(manager(), DOC_ID, { attachmentId: 'att-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a folder for management', async () => {
    const { service, prisma } = makeService();
    const folder = await service.createFolder(manager(), {
      condoId: CONDO,
      name: 'AGM minutes',
      audience: DocumentFolderAudience.OWNERS,
    });
    expect(folder.name).toBe('AGM minutes');
    expect(prisma.documentFolder.create).toHaveBeenCalled();
  });

  it('updates folder metadata', async () => {
    const { service, prisma } = makeService();
    await service.updateFolder(manager(), FOLDER_ID, { name: 'Updated rules' });
    expect(prisma.documentFolder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Updated rules' }),
      }),
    );
  });

  it('soft-deletes folders that still contain documents', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.documentFolder.findUnique).mockResolvedValueOnce({
      ...FOLDER,
      _count: { documents: 2 },
    } as never);
    await service.deleteFolder(manager(), FOLDER_ID);
    expect(prisma.documentFolder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
  });
});
