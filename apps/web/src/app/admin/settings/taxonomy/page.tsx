'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCreateDefectElement,
  useCreateDefectIssue,
  useCreateDefectSpaceType,
  useDefectTaxonomy,
  useDeleteDefectElement,
  useDeleteDefectIssue,
  useDeleteDefectSpaceType,
  useMyCondos,
} from '@smartresidence/api-client';
import type { DefectElementWithIssues, DefectSpaceTypeTree } from '@smartresidence/shared-types';
import { Button, Card, EmptyState, Input, Skeleton } from '@smartresidence/ui-web';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

export default function AdminTaxonomyPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const taxonomy = useDefectTaxonomy(api, condoId);
  const createSpaceType = useCreateDefectSpaceType(api);
  const [name, setName] = React.useState('');

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!condoId || !name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await createSpaceType.mutateAsync({ condoId, name: name.trim() });
      setName('');
      toast.success('Space type added');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Defect taxonomy</h2>
        <p className="sr-muted">
          Space → Element → Issue. Residents pick from this list when logging handover defects per
          room.
        </p>
      </header>

      <Card>
        <h3 className="font-semibold mb-3 text-sm">New space type</h3>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onCreate}>
          <div className="flex flex-1 flex-col gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bathroom, Kitchen, Bedroom"
              aria-label="Space type name"
            />
          </div>
          <Button type="submit" disabled={createSpaceType.isPending}>
            {createSpaceType.isPending ? 'Adding…' : 'Add space type'}
          </Button>
        </form>
      </Card>

      {taxonomy.isLoading ? (
        <Skeleton className="h-48" />
      ) : (taxonomy.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No taxonomy yet"
          description="Add a space type above, then its elements and issues."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {taxonomy.data?.map((st: DefectSpaceTypeTree) => (
            <SpaceTypeCard key={st.id} spaceType={st} />
          ))}
        </div>
      )}
    </div>
  );
}

function SpaceTypeCard({ spaceType }: { spaceType: DefectSpaceTypeTree }) {
  const deleteSpaceType = useDeleteDefectSpaceType(api);
  const createElement = useCreateDefectElement(api);
  const [elementName, setElementName] = React.useState('');

  async function onAddElement(e: React.FormEvent) {
    e.preventDefault();
    if (!elementName.trim()) return;
    try {
      await createElement.mutateAsync({ spaceTypeId: spaceType.id, name: elementName.trim() });
      setElementName('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold">{spaceType.name}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!window.confirm(`Delete "${spaceType.name}" and all its elements/issues?`)) return;
            try {
              await deleteSpaceType.mutateAsync(spaceType.id);
              toast.success('Deleted');
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 pl-1">
        {spaceType.elements.length === 0 ? (
          <p className="text-sm sr-muted">No elements yet.</p>
        ) : (
          spaceType.elements.map((el) => <ElementBlock key={el.id} element={el} />)
        )}
      </div>

      <form className="mt-3 flex items-center gap-2" onSubmit={onAddElement}>
        <Input
          value={elementName}
          onChange={(e) => setElementName(e.target.value)}
          placeholder="Add element (e.g. Tiles, Tap, Door)"
          aria-label="New element name"
        />
        <Button type="submit" variant="secondary" disabled={createElement.isPending}>
          <Plus className="size-4" /> Element
        </Button>
      </form>
    </Card>
  );
}

function ElementBlock({ element }: { element: DefectElementWithIssues }) {
  const deleteElement = useDeleteDefectElement(api);
  const createIssue = useCreateDefectIssue(api);
  const deleteIssue = useDeleteDefectIssue(api);
  const [issueName, setIssueName] = React.useState('');

  async function onAddIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!issueName.trim()) return;
    try {
      await createIssue.mutateAsync({ elementId: element.id, name: issueName.trim() });
      setIssueName('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="rounded-xl border border-[rgb(var(--sr-border))] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium">{element.name}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteElement.mutate(element.id)}
          aria-label={`Delete ${element.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {element.issues.map((iss) => (
          <span
            key={iss.id}
            className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--sr-bg))] px-2.5 py-1 text-xs"
          >
            {iss.name}
            <button
              type="button"
              onClick={() => deleteIssue.mutate(iss.id)}
              className="text-[rgb(var(--sr-muted))] hover:text-[rgb(var(--sr-coral))]"
              aria-label={`Delete ${iss.name}`}
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
        {element.issues.length === 0 ? (
          <span className="text-xs sr-muted">No issues yet.</span>
        ) : null}
      </div>
      <form className="flex items-center gap-2" onSubmit={onAddIssue}>
        <Input
          value={issueName}
          onChange={(e) => setIssueName(e.target.value)}
          placeholder="Add issue (e.g. Cracked tiles)"
          aria-label="New issue name"
          className="h-9"
        />
        <Button type="submit" variant="ghost" size="sm" disabled={createIssue.isPending}>
          <Plus className="size-4" />
        </Button>
      </form>
    </div>
  );
}
