'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadAttachment, useCreateDefect, useMyUnits } from '@smartresidence/api-client';
import {
  type CreateDefectInput,
  CreateDefectSchema,
  DEFECT_CATEGORIES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '@smartresidence/shared-types';
import {
  Button,
  Card,
  Input,
  Label,
  PhotoUpload,
  type PhotoUploadHandle,
  Textarea,
} from '@smartresidence/ui-web';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

export default function NewDefectPage() {
  const router = useRouter();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const create = useCreateDefect(api);
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>([]);
  const photoRef = React.useRef<PhotoUploadHandle>(null);
  const form = useForm<CreateDefectInput>({
    resolver: zodResolver(CreateDefectSchema),
    defaultValues: { unitId: '', severity: 'MEDIUM', category: 'Plumbing' },
  });

  async function onSubmit(values: CreateDefectInput) {
    if (!unit) return;
    try {
      await create.mutateAsync({
        ...values,
        unitId: unit.id,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      });
      photoRef.current?.reset();
      toast.success('Defect submitted');
      router.push('/defects');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="sr-section-title mb-1">Submit a defect</h2>
      <p className="sr-muted mb-6">Be specific — it helps the team triage faster.</p>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register('title')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="h-11 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 text-sm focus:border-[rgb(var(--sr-coral))] focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/30"
                {...form.register('category')}
              >
                {DEFECT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="severity">Severity</Label>
              <select
                id="severity"
                className="h-11 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 text-sm focus:border-[rgb(var(--sr-coral))] focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/30"
                {...form.register('severity')}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location (optional)</Label>
            <Input id="location" placeholder="Master bathroom" {...form.register('location')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={6} {...form.register('description')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Photos (optional)</Label>
            <PhotoUpload
              ref={photoRef}
              maxFiles={MAX_ATTACHMENTS_PER_MESSAGE}
              onChange={setAttachmentIds}
              upload={(file, opts) =>
                uploadAttachment(
                  api,
                  { file, fileName: file.name, contentType: file.type || 'image/jpeg' },
                  opts,
                )
              }
            />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Submitting…' : 'Submit defect'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
