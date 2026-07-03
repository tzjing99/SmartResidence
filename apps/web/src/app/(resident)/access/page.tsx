'use client';

import { toast } from '@/lib/toast';
import { ROLE_LABEL, type RoleId } from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@smartresidence/ui-web';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';

interface DelegatedGrant {
  id: string;
  roleId: RoleId;
  user: { id: string; name: string; email: string };
  unitId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function AccessPage() {
  const [grants, setGrants] = useState<DelegatedGrant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const items = await api.delegatedAccess();
      setGrants(items as DelegatedGrant[]);
    } catch {
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    if (!confirm('Revoke this access immediately? Active sessions will be killed.')) return;
    try {
      await api.revokeRoleAssignment(id);
      toast.success('Access revoked. Sessions killed.');
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="container-page space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Who has access to my unit</h1>
        <p className="text-muted-foreground mt-1">
          As the owner, you can revoke any delegated access at any time. Revoking a grant signs the
          user out of every device immediately.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-3">
          {['sk-1', 'sk-2', 'sk-3'].map((key) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-9 w-24 rounded-xl shrink-0" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : grants.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title="No delegated access"
              description="You haven't given anyone else access to your unit yet."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {grants.map((g) => (
            <Card key={g.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{g.user.name}</CardTitle>
                  <CardDescription>{g.user.email}</CardDescription>
                  <div className="mt-2 flex gap-2">
                    <Badge tone="info">{ROLE_LABEL[g.roleId]}</Badge>
                    {g.expiresAt ? (
                      <Badge tone="warning">
                        Expires {new Date(g.expiresAt).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">No expiry</Badge>
                    )}
                  </div>
                </div>
                <Button variant="destructive" onClick={() => revoke(g.id)}>
                  Revoke now
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
