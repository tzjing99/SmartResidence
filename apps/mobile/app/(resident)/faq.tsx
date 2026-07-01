import { useFaqArticles, useMarkFaqHelpful, useMyCondos } from '@smartresidence/api-client';
import { AppText, Button, Card, EmptyState, Input, Pill, palette } from '@smartresidence/ui-mobile';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  pinned: boolean;
  helpfulCount: number;
};

export default function FaqScreen() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const articles = useFaqArticles(api, condo?.id ?? null, debounced);
  const helpful = useMarkFaqHelpful(api);
  const [openId, setOpenId] = useState<string | null>(null);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => articles.refetch().then(() => undefined), [articles]),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const items = (articles.data?.items as FaqRow[] | undefined) ?? [];

  return (
    <ResidentScreen
      eyebrow="Help"
      title="Help & FAQ"
      subtitle="Answers curated by your management office."
      scrollProps={{ refreshControl }}
    >
      <Input value={query} onChangeText={setQuery} placeholder="Search the FAQ…" />

      <ResidentSectionHeader title="Articles" />

      {articles.isLoading ? (
        <Card style={residentStyles.card}>
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
            Loading articles…
          </AppText>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="No articles found"
          description={debounced ? 'Try a different search term.' : 'The FAQ is being prepared.'}
        />
      ) : (
        items.map((a) => {
          const open = openId === a.id;
          return (
            <Card key={a.id} style={residentStyles.card}>
              <Pressable onPress={() => setOpenId(open ? null : a.id)}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    {a.pinned ? (
                      <View style={{ alignSelf: 'flex-start' }}>
                        <Pill tone="primary" label="Pinned" />
                      </View>
                    ) : null}
                    <AppText
                      style={{ fontWeight: '700', color: palette.textLight }}
                      numberOfLines={open ? undefined : 2}
                    >
                      {a.question}
                    </AppText>
                  </View>
                  <AppText style={{ color: palette.mutedLight, fontSize: 16 }}>
                    {open ? '▲' : '▼'}
                  </AppText>
                </View>
              </Pressable>
              {open ? (
                <View
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: palette.borderLight,
                    gap: 12,
                  }}
                >
                  <AppText variant="bodySm" style={{ color: palette.textLight, lineHeight: 20 }}>
                    {a.answer}
                  </AppText>
                  <Button
                    title={`Helpful (${a.helpfulCount})`}
                    size="sm"
                    variant="ghost"
                    disabled={helpful.isPending}
                    onPress={() => void helpful.mutateAsync(a.id).catch(() => undefined)}
                  />
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </ResidentScreen>
  );
}
