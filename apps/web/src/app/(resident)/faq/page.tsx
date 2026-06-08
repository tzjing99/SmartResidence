'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useFaqArticles, useMarkFaqHelpful, useMyCondos } from '@smartresidence/api-client';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@smartresidence/ui-web';
import { ChevronDown, Search, ThumbsUp } from 'lucide-react';
import * as React from 'react';

export default function FaqPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const articles = useFaqArticles(api, condo?.id ?? null, debounced);
  const helpful = useMarkFaqHelpful(api);
  const [openId, setOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h2 className="sr-section-title">Help &amp; FAQ</h2>
        <p className="sr-muted">Answers curated by your management office.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 sr-muted" />
        <Input
          className="pl-10"
          placeholder="Search the FAQ…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {articles.isLoading ? (
        <Skeleton className="h-40" />
      ) : (articles.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No articles found"
          description={debounced ? 'Try a different search term.' : 'The FAQ is being prepared.'}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {articles.data?.items.map((a) => {
            const open = openId === a.id;
            return (
              <li key={a.id}>
                <Card>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setOpenId(open ? null : a.id)}
                  >
                    <span className="font-medium flex items-center gap-2">
                      {a.pinned ? <Badge tone="primary">Pinned</Badge> : null}
                      {a.question}
                    </span>
                    <ChevronDown
                      className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {open ? (
                    <div className="mt-3 pt-3 border-t border-[rgb(var(--sr-border))]">
                      <div className="text-sm whitespace-pre-line leading-relaxed">{a.answer}</div>
                      <div className="mt-4 flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await helpful.mutateAsync(a.id);
                              toast.success('Thanks for the feedback');
                            } catch (err) {
                              toast.error((err as Error).message);
                            }
                          }}
                        >
                          <ThumbsUp className="size-4" />
                          Helpful ({a.helpfulCount})
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
