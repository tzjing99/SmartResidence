'use client';

import { api } from '@/lib/api';
import { CATEGORIES } from '@/lib/thread-ui';
import { useCreateThread, useMyUnits } from '@smartresidence/api-client';
import type { ThreadCategory } from '@smartresidence/api-client';
import { Button, Card, Input, Label, Textarea } from '@smartresidence/ui-web';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

export default function NewMessagePage() {
  const router = useRouter();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const create = useCreateThread(api);

  const [subject, setSubject] = React.useState('');
  const [category, setCategory] = React.useState<ThreadCategory>('GENERAL');
  const [body, setBody] = React.useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.error('Please add a subject and a message');
      return;
    }
    try {
      const thread = await create.mutateAsync({
        unitId: unit?.id,
        subject: subject.trim(),
        category,
        body: body.trim(),
      });
      toast.success('Message sent to management');
      router.push(`/messages/${thread.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="sr-section-title mb-1">New message</h2>
      <p className="sr-muted mb-6">
        Pick a category so we route it to the right team and apply the correct SLA.
      </p>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Water leak in the kitchen ceiling"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="h-11 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 text-sm focus:border-[rgb(var(--sr-coral))] focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/30"
              value={category}
              onChange={(e) => setCategory(e.target.value as ThreadCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your question or issue…"
            />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Sending…' : 'Send message'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
