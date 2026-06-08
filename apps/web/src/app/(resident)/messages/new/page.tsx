'use client';

import { Markdown } from '@/components/markdown';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { CATEGORIES } from '@/lib/thread-ui';
import { toast } from '@/lib/toast';
import {
  uploadAttachment,
  useCreateThread,
  useFaqDeflectMatch,
  useMarkFaqHelpful,
  useMyCondos,
  useMyUnits,
} from '@smartresidence/api-client';
import type { ThreadCategory } from '@smartresidence/api-client';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  PhotoUpload,
  type PhotoUploadHandle,
  Textarea,
} from '@smartresidence/ui-web';
import { CheckCircle2, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export default function NewMessagePage() {
  const router = useRouter();
  const t = useT();
  const units = useMyUnits(api);
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const unit = units.data?.[0] as { id: string } | undefined;
  const create = useCreateThread(api);
  const deflect = useFaqDeflectMatch(api);
  const helpful = useMarkFaqHelpful(api);

  const [subject, setSubject] = React.useState('');
  const [category, setCategory] = React.useState<ThreadCategory>('GENERAL');
  const [body, setBody] = React.useState('');
  const [deflection, setDeflection] = React.useState<{
    articleId: string;
    question: string;
    answer: string;
  } | null>(null);
  const [dismissedDeflection, setDismissedDeflection] = React.useState(false);
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>([]);
  const photoUploadRef = React.useRef<PhotoUploadHandle>(null);

  React.useEffect(() => {
    if (!condo?.id || subject.trim().length < 5 || body.trim().length < 10) {
      setDeflection(null);
      return;
    }
    const timer = setTimeout(() => {
      deflect
        .mutateAsync({ condoId: condo.id, subject: subject.trim(), body: body.trim() })
        .then((res) => {
          if (res.match && !dismissedDeflection) {
            setDeflection({
              articleId: res.match.articleId,
              question: res.match.question,
              answer: res.match.answer,
            });
          } else if (!res.match) {
            setDeflection(null);
          }
        })
        .catch(() => setDeflection(null));
    }, 600);
    return () => clearTimeout(timer);
  }, [condo?.id, subject, body, dismissedDeflection, deflect]);

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
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      });
      photoUploadRef.current?.reset();
      toast.success('Message sent to management');
      router.push(`/messages/${thread.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onAnswered() {
    if (!deflection) return;
    try {
      await helpful.mutateAsync(deflection.articleId);
      toast.success('Glad we could help — no thread opened');
      router.push('/messages');
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

      {deflection && !dismissedDeflection ? (
        <Card className="mb-4 border-emerald-500/40 bg-emerald-500/5">
          <div className="flex items-start gap-2 mb-2">
            <Lightbulb className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">This FAQ might answer your question</div>
              <Badge tone="success" className="mt-1">
                Strong match
              </Badge>
            </div>
          </div>
          <div className="font-medium text-sm mt-3">{deflection.question}</div>
          <div className="text-sm sr-muted mt-2 prose-sm max-w-none">
            <Markdown>{deflection.answer}</Markdown>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button type="button" onClick={onAnswered} disabled={helpful.isPending}>
              <CheckCircle2 className="size-4" />
              This answered my question
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDismissedDeflection(true);
                setDeflection(null);
              }}
            >
              Still need help — send message
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setDismissedDeflection(false);
              }}
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
              onChange={(e) => {
                setBody(e.target.value);
                setDismissedDeflection(false);
              }}
              placeholder="Describe your question or issue…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('upload.photos')}</Label>
            <PhotoUpload
              ref={photoUploadRef}
              maxFiles={MAX_ATTACHMENTS_PER_MESSAGE}
              onChange={setAttachmentIds}
              upload={(file, opts) =>
                uploadAttachment(
                  api,
                  { file, fileName: file.name, contentType: file.type || 'image/jpeg' },
                  opts,
                )
              }
              labels={{
                cta: t('upload.cta'),
                hint: t('upload.hint'),
                retry: t('upload.retry'),
                remove: t('upload.remove'),
                cancel: t('upload.cancel'),
                tooMany: t('upload.tooMany'),
              }}
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
