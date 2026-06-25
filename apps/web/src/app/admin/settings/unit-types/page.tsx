'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useAddUnitTypeSpace,
  useCreateUnitType,
  useDefectTaxonomy,
  useDeleteUnitType,
  useDeleteUnitTypeSpace,
  useMyCondos,
  useUnitTypes,
  useUpdateUnitType,
  useUpdateUnitTypeSpace,
} from '@smartresidence/api-client';
import type { DefectSpaceTypeTree, UnitType } from '@smartresidence/shared-types';
import { Button, Card, EmptyState, Input, Label, Select, Skeleton } from '@smartresidence/ui-web';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

const NO_SPACE_TYPE = '__none__';

export default function AdminUnitTypesPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const unitTypes = useUnitTypes(api, condoId);
  const taxonomy = useDefectTaxonomy(api, condoId);
  const createType = useCreateUnitType(api);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const spaceTypeOptions = [
    { value: NO_SPACE_TYPE, label: 'No taxonomy' },
    ...(taxonomy.data ?? []).map((s: DefectSpaceTypeTree) => ({ value: s.id, label: s.name })),
  ];

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!condoId || !name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await createType.mutateAsync({
        condoId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      toast.success('Unit type created');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Unit types & room templates</h2>
        <p className="sr-muted">
          Define unit layouts and the rooms each contains. Residents use these rooms when submitting
          a handover inspection.
        </p>
      </header>

      <Card>
        <h3 className="font-semibold mb-3 text-sm">New unit type</h3>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onCreate}>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="ut-name">Name</Label>
            <Input
              id="ut-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Type A — 2 Bedroom"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="ut-desc">Description (optional)</Label>
            <Input
              id="ut-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. ~1,100 sqft"
            />
          </div>
          <Button type="submit" disabled={createType.isPending}>
            {createType.isPending ? 'Adding…' : 'Add'}
          </Button>
        </form>
      </Card>

      {unitTypes.isLoading ? (
        <Skeleton className="h-48" />
      ) : (unitTypes.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No unit types yet"
          description="Create your first unit type above, then add its rooms."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {unitTypes.data?.map((ut) => (
            <UnitTypeCard key={ut.id} unitType={ut} spaceTypeOptions={spaceTypeOptions} />
          ))}
        </div>
      )}
    </div>
  );
}

function UnitTypeCard({
  unitType,
  spaceTypeOptions,
}: {
  unitType: UnitType;
  spaceTypeOptions: Array<{ value: string; label: string }>;
}) {
  const updateType = useUpdateUnitType(api);
  const deleteType = useDeleteUnitType(api);
  const addSpace = useAddUnitTypeSpace(api);
  const updateSpace = useUpdateUnitTypeSpace(api);
  const deleteSpace = useDeleteUnitTypeSpace(api);

  const [name, setName] = React.useState(unitType.name);
  const [roomName, setRoomName] = React.useState('');
  const [roomSpaceType, setRoomSpaceType] = React.useState(NO_SPACE_TYPE);

  React.useEffect(() => setName(unitType.name), [unitType.name]);

  async function saveName() {
    if (name.trim() && name.trim() !== unitType.name) {
      try {
        await updateType.mutateAsync({ id: unitType.id, data: { name: name.trim() } });
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
  }

  async function onAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) {
      toast.error('Room name is required');
      return;
    }
    try {
      await addSpace.mutateAsync({
        unitTypeId: unitType.id,
        data: {
          name: roomName.trim(),
          spaceTypeId: roomSpaceType === NO_SPACE_TYPE ? null : roomSpaceType,
        },
      });
      setRoomName('');
      setRoomSpaceType(NO_SPACE_TYPE);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="font-semibold max-w-md"
          aria-label="Unit type name"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!window.confirm(`Delete "${unitType.name}"? Tagged units will be untyped.`)) return;
            try {
              await deleteType.mutateAsync(unitType.id);
              toast.success('Unit type deleted');
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase sr-muted">Rooms</span>
        {(unitType.spaces?.length ?? 0) === 0 ? (
          <p className="text-sm sr-muted">No rooms yet — add the first below.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unitType.spaces?.map((room) => (
              <li
                key={room.id}
                className="flex items-center gap-3 rounded-xl border border-[rgb(var(--sr-border))] px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium">{room.name}</span>
                <Select
                  value={room.spaceTypeId ?? NO_SPACE_TYPE}
                  onValueChange={(v) =>
                    updateSpace.mutate({
                      id: room.id,
                      data: { spaceTypeId: v === NO_SPACE_TYPE ? null : v },
                    })
                  }
                  options={spaceTypeOptions}
                  aria-label={`Space type for ${room.name}`}
                  className="w-44"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSpace.mutate(room.id)}
                  aria-label={`Delete ${room.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onAddRoom}>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`room-${unitType.id}`} className="text-xs">
            Room name
          </Label>
          <Input
            id={`room-${unitType.id}`}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g. Bathroom 1"
          />
        </div>
        <Select
          value={roomSpaceType}
          onValueChange={setRoomSpaceType}
          options={spaceTypeOptions}
          aria-label="Room space type"
          className="w-44"
        />
        <Button type="submit" variant="secondary" disabled={addSpace.isPending}>
          <Plus className="size-4" /> Room
        </Button>
      </form>
    </Card>
  );
}
