'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useCondoDocuments, useDocumentFolders, useMyCondos } from '@smartresidence/api-client';
import type { Document, DocumentFolder } from '@smartresidence/shared-types';
import { DOCUMENT_FOLDER_AUDIENCE_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Download, FileText, FolderOpen } from 'lucide-react';
import * as React from 'react';

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ResidentDocumentsPage() {
  useRoleGuard('resident');
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;

  const folders = useDocumentFolders(api, condoId);
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null);
  const docs = useCondoDocuments(api, condoId, { folderId: selectedFolderId ?? undefined });

  React.useEffect(() => {
    if (!selectedFolderId && folders.data?.[0]?.id) {
      setSelectedFolderId(folders.data[0].id);
    }
  }, [folders.data, selectedFolderId]);

  const folderRows = (folders.data ?? []) as DocumentFolder[];
  const docRows = (docs.data ?? []) as Document[];

  const download = async (doc: Document) => {
    const versionId = doc.currentVersion?.id;
    if (!versionId) {
      toast.error('This document has not been published yet');
      return;
    }
    try {
      const res = await api.documentVersionDownloadUrl(versionId);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (condos.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm sr-muted mt-1">
          House rules, AGM minutes, bylaws, and management circulars for your condo.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5" aria-hidden />
          Folders
        </h2>
        {folders.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : folderRows.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="When management publishes documents, they will appear here."
          />
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
              </Button>
            ))}
          </div>
        )}
      </section>

      {selectedFolderId ? (
        <section className="space-y-4">
          {(() => {
            const folder = folderRows.find((f) => f.id === selectedFolderId);
            if (!folder) return null;
            return (
              <p className="text-sm sr-muted">
                Visible to: {DOCUMENT_FOLDER_AUDIENCE_LABELS[folder.audience]}
              </p>
            );
          })()}

          {docs.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : docRows.length === 0 ? (
            <EmptyState title="No documents in this folder" />
          ) : (
            <div className="grid gap-3">
              {docRows.map((doc) => (
                <Card key={doc.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      <div className="font-semibold">{doc.title}</div>
                      {doc.description ? (
                        <p className="text-sm sr-muted truncate">{doc.description}</p>
                      ) : null}
                      {doc.currentVersion ? (
                        <p className="text-xs sr-muted mt-1">
                          Version {doc.currentVersion.versionNumber} ·{' '}
                          {fmtDate(doc.currentVersion.publishedAt)} ·{' '}
                          {fmtBytes(doc.currentVersion.sizeBytes)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.currentVersion ? (
                      <Badge tone="success">PDF</Badge>
                    ) : (
                      <Badge tone="neutral">Pending</Badge>
                    )}
                    <Button
                      size="sm"
                      disabled={!doc.currentVersion}
                      onClick={() => void download(doc)}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
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
