'use client';

import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useCondoAnnouncements, useMyCondos } from '@smartresidence/api-client';
import { Badge, Button, Card, Input, Label, Textarea } from '@smartresidence/ui-web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function AdminAnnouncementsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const list = useCondoAnnouncements(api, condo?.id ?? null);
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [importance, setImportance] = useState('INFO');

  const create = useMutation({
    mutationFn: () => {
      if (!condo) throw new Error('No condo');
      return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('sr.session.v1') ?? '{}').accessToken ?? ''}`,
        },
        body: JSON.stringify({ condoId: condo.id, title, body, importance }),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      toast.success('Announcement published');
      setTitle('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h2 className="font-semibold mb-4">Compose announcement</h2>
        <div className="flex flex-col gap-3">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Label>Importance</Label>
          <select
            value={importance}
            onChange={(e) => setImportance(e.target.value)}
            className="h-11 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 text-sm"
          >
            <option value="INFO">Info</option>
            <option value="IMPORTANT">Important</option>
            <option value="URGENT">Urgent</option>
          </select>
          <Label>Body (markdown)</Label>
          <Textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              '## Heading\nUse **bold**, _italic_, lists and [links](https://example.com).'
            }
          />
          <div>
            <div className="text-xs sr-muted mb-1.5">Preview</div>
            <div className="min-h-[5rem] rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))] px-4 py-3 text-sm">
              {body.trim() ? (
                <Markdown>{body}</Markdown>
              ) : (
                <span className="sr-muted">Formatted markdown shows up here as you type.</span>
              )}
            </div>
          </div>
          <Button onClick={() => create.mutate()} disabled={!title || !body || create.isPending}>
            {create.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Recent</h2>
        {(list.data?.items as any[] | undefined)?.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium">{a.title}</h3>
              <Badge
                tone={
                  a.importance === 'URGENT'
                    ? 'danger'
                    : a.importance === 'IMPORTANT'
                      ? 'warning'
                      : 'info'
                }
              >
                {a.importance.toLowerCase()}
              </Badge>
            </div>
            <div className="text-xs sr-muted">
              {a.publishedAt ? new Date(a.publishedAt).toLocaleString() : 'unpublished'}
            </div>
            <Markdown className="mt-2 max-h-32 overflow-hidden text-sm">{a.body}</Markdown>
          </Card>
        ))}
      </div>
    </div>
  );
}
