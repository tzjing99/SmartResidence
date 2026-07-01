'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  uploadAttachment,
  useCondoDocuments,
  useCreateDocument,
  useCreateDocumentFolder,
  useDocumentFolders,
  useMyCondos,
  usePublishDocumentVersion,
  useUpdateDocumentFolder,
} from '@smartresidence/api-client';
import type { Document, DocumentFolder, DocumentFolderAudience } from '@smartresidence/shared-types';
import { DOCUMENT_FOLDER_AUDIENCE_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { FileText, FolderOpen, Loader2, Upload } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminDocumentsPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;

  const folders = useDocumentFolders(api, condoId, { includeInactive: true });
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null);
  const docs = useCondoDocuments(api, condoId, {
    folderId: selectedFolderId ?? undefined,
    includeInactive: true,
  });

  const createFolder = useCreateDocumentFolder(api);
  const updateFolder = useUpdateDocumentFolder(api);
  const createDocument = useCreateDocument(api);
  const publishVersion = usePublishDocumentVersion(api);

  const [newFolderName, setNewFolderName] = React.useState('');
  const [newFolderAudience, setNewFolderAudience] = React.useState<DocumentFolderAudience>('ALL');
  const [newDocTitle, setNewDocTitle] = React.useState('');
  const [newDocDescription, setNewDocDescription] = React.useState('');
  const [uploadDocId, setUploadDocId] = React.useState<string | null>(null);
  const [uploadNotes, setUploadNotes] = React.useState('');
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!selectedFolderId && folders.data?.[0]?.id) {
      setSelectedFolderId(folders.data[0].id);
    }
  }, [folders.data, selectedFolderId]);

  const folderRows = (folders.data ?? []) as DocumentFolder[];
  const docRows = (docs.data ?? []) as Document[];

  const addFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId || !newFolderName.trim()) return;
    try {
      const created = await createFolder.mutateAsync({
        condoId,
        name: newFolderName.trim(),
        audience: newFolderAudience,
      });
      setNewFolderName('');
      setSelectedFolderId(created.id);
      toast.success('Folder created');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const addDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId || !newDocTitle.trim()) return;
    try {
      await createDocument.mutateAsync({
        folderId: selectedFolderId,
        title: newDocTitle.trim(),
        description: newDocDescription.trim() || undefined,
      });
      setNewDocTitle('');
      setNewDocDescription('');
      toast.success('Document created — upload a PDF to publish');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onPdfUpload = async (docId: string, file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadAttachment(api, {
        fileName: file.name,
        contentType: 'application/pdf',
        file,
      });
      await publishVersion.mutateAsync({
        documentId: docId,
        input: { attachmentId: uploaded.attachmentId, notes: uploadNotes.trim() || undefined },
      });
      toast.success('New version published — residents notified');
      setUploadDocId(null);
      setUploadNotes('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (condos.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document library</h1>
        <p className="text-sm sr-muted mt-1">
          Publish house rules, AGM minutes, bylaws, and circulars with version history.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5" aria-hidden />
          Folders
        </h2>
        {folders.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {folderRows.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={selectedFolderId === f.id ? 'primary' : 'secondary'}
                onClick={() => setSelectedFolderId(f.id)}
              >
                {f.name}
                {!f.active ? ' (hidden)' : ''}
              </Button>
            ))}
            {folderRows.length === 0 ? (
              <p className="text-sm sr-muted">No folders yet — create one below.</p>
            ) : null}
          </div>
        )}

        <Card className="p-4 space-y-3">
          <form className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end" onSubmit={addFolder}>
            <div>
              <Label htmlFor="folder-name">New folder</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. House rules"
              />
            </div>
            <div>
              <Label htmlFor="folder-audience">Who can read</Label>
              <select
                id="folder-audience"
                className={selectCls}
                value={newFolderAudience}
                onChange={(e) => setNewFolderAudience(e.target.value as DocumentFolderAudience)}
              >
                {(Object.keys(DOCUMENT_FOLDER_AUDIENCE_LABELS) as DocumentFolderAudience[]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {DOCUMENT_FOLDER_AUDIENCE_LABELS[k]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <Button type="submit" disabled={!condoId || createFolder.isPending}>
              Add folder
            </Button>
          </form>
          {selectedFolderId ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const folder = folderRows.find((f) => f.id === selectedFolderId);
                  if (!folder) return;
                  try {
                    await updateFolder.mutateAsync({
                      id: folder.id,
                      data: { active: !folder.active },
                    });
                    toast.success(folder.active ? 'Folder hidden' : 'Folder restored');
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                Toggle folder visibility
              </Button>
            </div>
          ) : null}
        </Card>
      </section>

      {selectedFolderId ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" aria-hidden />
            Documents
          </h2>

          <Card className="p-4 space-y-3">
            <form className="grid gap-3" onSubmit={addDocument}>
              <div>
                <Label htmlFor="doc-title">New document title</Label>
                <Input
                  id="doc-title"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="e.g. By-laws 2024"
                />
              </div>
              <div>
                <Label htmlFor="doc-desc">Description (optional)</Label>
                <Input
                  id="doc-desc"
                  value={newDocDescription}
                  onChange={(e) => setNewDocDescription(e.target.value)}
                  placeholder="Short summary for residents"
                />
              </div>
              <Button type="submit" disabled={createDocument.isPending}>
                Create document
              </Button>
            </form>
          </Card>

          {docs.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : docRows.length === 0 ? (
            <EmptyState
              title="No documents in this folder"
              description="Create a document, then upload a PDF to publish the first version."
            />
          ) : (
            <div className="grid gap-4">
              {docRows.map((doc) => (
                <Card key={doc.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{doc.title}</div>
                      {doc.description ? (
                        <p className="text-sm sr-muted mt-1">{doc.description}</p>
                      ) : null}
                    </div>
                    <Badge tone={doc.currentVersion ? 'success' : 'warning'}>
                      {doc.currentVersion
                        ? `v${doc.currentVersion.versionNumber} · ${fmtDate(doc.currentVersion.publishedAt)}`
                        : 'No published version'}
                    </Badge>
                  </div>
                  {doc.currentVersion ? (
                    <p className="text-sm sr-muted">
                      {fmtBytes(doc.currentVersion.sizeBytes)} ·{' '}
                      {doc.currentVersion.uploadedBy?.name ?? 'Management'}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium px-3 py-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/80">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onPdfUpload(doc.id, file);
                          e.target.value = '';
                        }}
                        disabled={uploading || publishVersion.isPending}
                      />
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload new version
                    </label>
                    {uploadDocId === doc.id ? (
                      <Input
                        className="max-w-xs"
                        placeholder="Version notes (optional)"
                        value={uploadNotes}
                        onChange={(e) => setUploadNotes(e.target.value)}
                      />
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setUploadDocId(doc.id)}>
                        Add notes
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
