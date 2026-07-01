import {
  useCondoDocuments,
  useDocumentFolders,
  useMyCondos,
} from '@smartresidence/api-client';
import type { Document, DocumentFolder } from '@smartresidence/shared-types';
import { DOCUMENT_FOLDER_AUDIENCE_LABELS } from '@smartresidence/shared-types';
import { AppText, Button, Card, EmptyState, palette, Pill } from '@smartresidence/ui-mobile';
import * as Linking from 'expo-linking';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';

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

export default function DocumentsScreen() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const folders = useDocumentFolders(api, condoId);
  const [folderId, setFolderId] = useState<string | null>(null);
  const docs = useCondoDocuments(api, condoId, { folderId: folderId ?? undefined });

  const folderRows = (folders.data ?? []) as DocumentFolder[];
  const docRows = (docs.data ?? []) as Document[];

  const activeFolderId = folderId ?? folderRows[0]?.id ?? null;
  const activeFolder = useMemo(
    () => folderRows.find((f) => f.id === activeFolderId) ?? null,
    [folderRows, activeFolderId],
  );

  const { refreshControl } = usePullToRefresh(
    useCallback(
      () => Promise.all([folders.refetch(), docs.refetch()]).then(() => undefined),
      [docs, folders],
    ),
  );

  const download = async (doc: Document) => {
    const versionId = doc.currentVersion?.id;
    if (!versionId) {
      Alert.alert('Not available', 'This document has not been published yet.');
      return;
    }
    try {
      const res = await api.documentVersionDownloadUrl(versionId);
      await Linking.openURL(res.url);
    } catch (err) {
      Alert.alert('Download failed', (err as Error).message);
    }
  };

  return (
    <ResidentScreen
      eyebrow="Services"
      title="Documents"
      subtitle="House rules, AGM minutes, bylaws, and circulars"
      scrollProps={{ refreshControl }}
    >
      <ResidentSectionHeader title="Folders" />
      {folders.isLoading ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading…
        </AppText>
      ) : folderRows.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="When management publishes documents, they will appear here."
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
            {folderRows.map((f) => (
              <Pressable key={f.id} onPress={() => setFolderId(f.id)}>
                <Pill tone={activeFolderId === f.id ? 'success' : 'neutral'} label={f.name} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {activeFolder ? (
        <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 8 }}>
          {DOCUMENT_FOLDER_AUDIENCE_LABELS[activeFolder.audience]}
        </AppText>
      ) : null}

      <ResidentSectionHeader title="Files" />
      {docs.isLoading ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading…
        </AppText>
      ) : docRows.length === 0 ? (
        <EmptyState title="No documents in this folder" />
      ) : (
        <View style={{ gap: 12 }}>
          {docRows.map((doc) => (
            <Card key={doc.id} style={[residentStyles.card, { gap: 8 }]}>
              <AppText style={{ fontWeight: '700', color: palette.textLight }}>{doc.title}</AppText>
              {doc.description ? (
                <AppText variant="meta" style={{ color: palette.mutedLight }}>
                  {doc.description}
                </AppText>
              ) : null}
              {doc.currentVersion ? (
                <AppText variant="meta" style={{ color: palette.mutedLight }}>
                  v{doc.currentVersion.versionNumber} · {fmtDate(doc.currentVersion.publishedAt)} ·{' '}
                  {fmtBytes(doc.currentVersion.sizeBytes)}
                </AppText>
              ) : (
                <AppText variant="meta" style={{ color: palette.mutedLight }}>
                  Not published yet
                </AppText>
              )}
              <Button
                title="Download PDF"
                disabled={!doc.currentVersion}
                onPress={() => void download(doc)}
              />
            </Card>
          ))}
        </View>
      )}
    </ResidentScreen>
  );
}
