'use client';

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { ApiClient } from '../client';
import { useMe, useMyCondos } from '../hooks/index';
import {
  type RealtimeConnectConfig,
  connectRealtime,
  disconnectRealtime,
  joinThreadRoom,
  leaveThreadRoom,
} from './socket';
import { type ThreadSocketPayload, syncThreadFromSocket } from './thread-cache';

export interface RealtimeProviderProps {
  api: ApiClient;
  baseUrl: string;
  /** Return false when there is no session (e.g. sign-in page). */
  enabled?: boolean;
  children: React.ReactNode;
}

const RealtimeCtx = React.createContext<boolean>(false);

export function useRealtimeReady() {
  return React.useContext(RealtimeCtx);
}

function attachThreadListeners(
  qc: QueryClient,
  api: ApiClient,
  socket: ReturnType<typeof connectRealtime>,
) {
  const onMessage = (payload: ThreadSocketPayload) => {
    void syncThreadFromSocket(qc, api, payload);
  };
  const onUpdate = (payload: ThreadSocketPayload) => {
    void syncThreadFromSocket(qc, api, payload);
  };
  const onSla = (payload: ThreadSocketPayload) => {
    void syncThreadFromSocket(qc, api, payload);
  };

  socket.on('thread:message', onMessage);
  socket.on('thread:update', onUpdate);
  socket.on('thread:sla', onSla);

  return () => {
    socket.off('thread:message', onMessage);
    socket.off('thread:update', onUpdate);
    socket.off('thread:sla', onSla);
  };
}

/**
 * Maintains a condo-scoped Socket.IO connection and patches TanStack Query
 * thread caches on `thread:message`, `thread:update`, and `thread:sla` events.
 */
export function RealtimeProvider({
  api,
  baseUrl,
  enabled = true,
  children,
}: RealtimeProviderProps) {
  const qc = useQueryClient();
  const me = useMe(api, { enabled });
  const condos = useMyCondos(api);
  const [ready, setReady] = React.useState(false);

  const userId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const condoId = condos.data?.[0]?.id as string | undefined;

  React.useEffect(() => {
    if (!enabled || !userId || !condoId) {
      setReady(false);
      return;
    }

    const cfg: RealtimeConnectConfig = { baseUrl, condoId, userId };
    const socket = connectRealtime(cfg);
    setReady(true);

    const detach = attachThreadListeners(qc, api, socket);

    return () => {
      detach();
      disconnectRealtime();
      setReady(false);
    };
  }, [enabled, userId, condoId, baseUrl, api, qc]);

  return <RealtimeCtx.Provider value={ready}>{children}</RealtimeCtx.Provider>;
}

/** Join / leave a thread room while a conversation detail screen is mounted. */
export function useThreadRoom(threadId: string | null | undefined) {
  React.useEffect(() => {
    if (!threadId) return;
    joinThreadRoom(threadId);
    return () => leaveThreadRoom(threadId);
  }, [threadId]);
}
