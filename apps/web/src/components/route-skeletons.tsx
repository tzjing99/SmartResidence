import { Skeleton } from '@smartresidence/ui-web';

/** Shared page header placeholder (title + subtitle). */
export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <header className={action ? 'flex items-center justify-between gap-4' : 'flex flex-col gap-2'}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action ? <Skeleton className="h-10 w-32 shrink-0 rounded-xl" /> : null}
    </header>
  );
}

/** Resident home dashboard — stat cards + list block. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid md:grid-cols-2 gap-4">
        {['a', 'b', 'c', 'd'].map((key) => (
          <Skeleton key={key} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

/** Thread / message list rows. */
export function MessageListSkeleton({ rows = 3 }: { rows?: number }) {
  const keys = ['m-a', 'm-b', 'm-c', 'm-d', 'm-e', 'm-f'].slice(0, rows);
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      <div className="flex flex-col gap-3">
        {keys.map((key) => (
          <Skeleton key={key} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Helpdesk inbox with filter bar. */
export function HelpdeskListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-3">
        {['f1', 'f2', 'f3', 'f4', 'f5'].map((key) => (
          <Skeleton key={key} className="h-9 w-32 rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {['r1', 'r2', 'r3', 'r4'].map((key) => (
          <Skeleton key={key} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Thread detail — header, messages, composer. */
export function ThreadDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-xl shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="flex flex-col gap-3">
        {['m1', 'm2', 'm3', 'm4', 'm5'].map((key) => (
          <Skeleton
            key={key}
            className={`h-16 rounded-xl ${key === 'm2' || key === 'm4' ? 'ml-8' : ''}`}
          />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

/** Settings section with sub-nav pills + form card. */
export function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-36" />
        <div className="flex flex-wrap gap-2">
          {['p1', 'p2', 'p3'].map((key) => (
            <Skeleton key={key} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

/** Generic list / table page. */
export function GenericPageSkeleton({ rows = 4 }: { rows?: number }) {
  const keys = ['g-a', 'g-b', 'g-c', 'g-d', 'g-e', 'g-f'].slice(0, rows);
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3">
        {keys.map((key) => (
          <Skeleton key={key} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Visitor list with pill tabs (resident / guard expected). */
export function VisitorListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      <div className="flex gap-2 overflow-hidden">
        {['t1', 't2', 't3', 't4'].map((key) => (
          <Skeleton key={key} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {['v1', 'v2', 'v3'].map((key) => (
          <Skeleton key={key} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Sidebar nav placeholders while auth resolves. */
export function ShellNavSkeleton({ count = 6 }: { count?: number }) {
  const keys = ['n-a', 'n-b', 'n-c', 'n-d', 'n-e', 'n-f', 'n-g', 'n-h'].slice(0, count);
  return (
    <div className="flex flex-col gap-1">
      {keys.map((key) => (
        <Skeleton key={key} className="h-10 rounded-xl" />
      ))}
    </div>
  );
}
