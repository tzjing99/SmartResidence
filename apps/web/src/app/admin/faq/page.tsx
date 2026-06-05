'use client';

import { api } from '@/lib/api';
import {
  useCreateFaqArticle,
  useDeleteFaqArticle,
  useFaqCategories,
  useFaqManageList,
  useMyCondos,
  useUpdateFaqArticle,
} from '@smartresidence/api-client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@smartresidence/ui-web';
import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

const selectCls =
  'h-11 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 text-sm';

export default function AdminFaqPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const condoId = condo?.id ?? null;
  const list = useFaqManageList(api, condoId);
  const categories = useFaqCategories(api, condoId);
  const create = useCreateFaqArticle(api);
  const updateArticle = useUpdateFaqArticle(api);
  const remove = useDeleteFaqArticle(api);

  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [published, setPublished] = React.useState(true);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!condoId || !question.trim() || !answer.trim()) {
      toast.error('Question and answer are required');
      return;
    }
    try {
      await create.mutateAsync({
        condoId,
        categoryId: categoryId || undefined,
        question: question.trim(),
        answer: answer.trim(),
        published,
      });
      setQuestion('');
      setAnswer('');
      toast.success('Article saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <h2 className="sr-section-title">FAQ management</h2>
        <p className="sr-muted">
          Publish answers residents can self-serve, reducing repeat questions.
        </p>
      </header>

      <Card>
        <h3 className="font-semibold mb-4">New article</h3>
        <form className="flex flex-col gap-4" onSubmit={onCreate}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q">Question</Label>
            <Input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a">Answer</Label>
            <Textarea id="a" rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat">Category</Label>
              <select
                id="cat"
                className={selectCls}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Uncategorised</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm self-end pb-3">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Publish immediately
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Add article'}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h3 className="font-semibold mb-3">Articles</h3>
        {list.isLoading ? (
          <Skeleton className="h-40" />
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No FAQ articles yet" description="Add your first answer above." />
        ) : (
          <ul className="flex flex-col gap-3">
            {list.data?.items.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">{a.question}</div>
                    <div className="text-xs sr-muted mt-0.5">
                      {a.category?.name ?? 'Uncategorised'} · {a.viewCount} views · {a.helpfulCount}{' '}
                      helpful
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={a.published ? 'success' : 'neutral'}>
                      {a.published ? 'Published' : 'Draft'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateArticle.mutate({ id: a.id, data: { published: !a.published } })
                      }
                    >
                      {a.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await remove.mutateAsync(a.id);
                          toast.success('Deleted');
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
