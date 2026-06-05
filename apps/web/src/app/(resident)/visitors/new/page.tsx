'use client';

import { api } from '@/lib/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateVisitor, useMyUnits } from '@smartresidence/api-client';
import { type CreateVisitorInput, CreateVisitorSchema } from '@smartresidence/shared-types';
import { Button, Card, Input, Label, Textarea } from '@smartresidence/ui-web';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

export default function NewVisitorPage() {
  const router = useRouter();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const create = useCreateVisitor(api);

  const form = useForm<CreateVisitorInput>({
    resolver: zodResolver(CreateVisitorSchema),
    defaultValues: { unitId: unit?.id ?? '' },
  });

  async function onSubmit(values: CreateVisitorInput) {
    if (!unit) return;
    const payload: CreateVisitorInput = { ...values, unitId: unit.id };
    try {
      await create.mutateAsync(payload);
      toast.success('Visitor pass created');
      router.push('/visitors');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="sr-section-title mb-1">Pre-register a visitor</h2>
      <p className="sr-muted mb-6">A QR pass is generated automatically.</p>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Visitor name</Label>
            <Input id="name" {...form.register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register('phone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehiclePlate">Plate number</Label>
              <Input id="vehiclePlate" {...form.register('vehiclePlate')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expectedAt">Expected arrival</Label>
            <Input
              id="expectedAt"
              type="datetime-local"
              {...form.register('expectedAt', {
                setValueAs: (v) => (v ? new Date(v) : v),
              })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purpose">Purpose (optional)</Label>
            <Textarea id="purpose" {...form.register('purpose')} />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating…' : 'Create pass'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
