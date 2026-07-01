'use client';

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { ApiClient } from '../client';
import { queryKeys, useMe, useMyCondos } from '../hooks/index';
import {
  type RealtimeConnectConfig,
  connectRealtime,
  disconnectRealtime,
  joinThreadRoom,
  leaveThreadRoom,
} from './socket';
import { type ThreadSocketPayload, syncThreadFromSocket } from './thread-cache';

export interface NotificationSocketPayload {
  userId: string;
  kind: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface RealtimeProviderProps {
  api: ApiClient;
  baseUrl: string;
  /** Return false when there is no session (e.g. sign-in page). */
  enabled?: boolean;
  /** Called on every incoming realtime notification (for toasts / prompts). */
  onNotification?: (payload: NotificationSocketPayload) => void;
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
  onNotification?: (payload: NotificationSocketPayload) => void,
) {
  const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>();

  const scheduleVisitorInvalidation = (condoId: string) => {
    const existing = pendingInvalidations.get(condoId);
    if (existing) clearTimeout(existing);
    pendingInvalidations.set(
      condoId,
      setTimeout(() => {
        pendingInvalidations.delete(condoId);
        qc.invalidateQueries({ queryKey: queryKeys.guardLiveVisitors(condoId) });
        qc.invalidateQueries({ queryKey: ['visitors', 'condo', condoId] });
        qc.invalidateQueries({ queryKey: ['visitors', 'unit'] });
      }, 400),
    );
  };

  const onMessage = (payload: ThreadSocketPayload) => {
    void syncThreadFromSocket(qc, api, payload);
  };
  const onUpdate = (payload: ThreadSocketPayload) => {
    void syncThreadFromSocket(qc, api, payload);
  };
  const onSla = (payload: ThreadSocketPayload) => {
    void syncThreadFromSocket(qc, api, payload);
  };
  const onVisitorUpdate = (payload: { condoId?: string }) => {
    if (payload.condoId) {
      scheduleVisitorInvalidation(payload.condoId);
    }
  };
  const onNotificationEvent = (payload: NotificationSocketPayload) => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: queryKeys.whoViewedMe });
    qc.invalidateQueries({ queryKey: queryKeys.myActivity });
    onNotification?.(payload);
  };
  const onSosUpdate = () => {
    qc.invalidateQueries({ queryKey: ['sos'] });
  };
  const onPatrolUpdate = () => {
    qc.invalidateQueries({ queryKey: ['patrol'] });
  };
  const onFormUpdate = () => {
    qc.invalidateQueries({ queryKey: ['forms'] });
  };

  socket.on('thread:message', onMessage);
  socket.on('thread:update', onUpdate);
  socket.on('thread:sla', onSla);
  socket.on('visitor:update', onVisitorUpdate);
  socket.on('notification:new', onNotificationEvent);
  socket.on('sos:update', onSosUpdate);
  socket.on('patrol:update', onPatrolUpdate);
  socket.on('form:update', onFormUpdate);

  return () => {
    for (const timer of pendingInvalidations.values()) {
      clearTimeout(timer);
    }
    pendingInvalidations.clear();
    socket.off('thread:message', onMessage);
    socket.off('thread:update', onUpdate);
    socket.off('thread:sla', onSla);
    socket.off('visitor:update', onVisitorUpdate);
    socket.off('notification:new', onNotificationEvent);
    socket.off('sos:update', onSosUpdate);
    socket.off('patrol:update', onPatrolUpdate);
    socket.off('form:update', onFormUpdate);
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
  onNotification,
  children,
}: RealtimeProviderProps) {
  const qc = useQueryClient();
  const me = useMe(api, { enabled });
  const condos = useMyCondos(api, { enabled });
  const [ready, setReady] = React.useState(false);

  const userId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const condoId = condos.data?.[0]?.id as string | undefined;

  // Keep the latest callback without re-subscribing the socket on each render.
  const onNotificationRef = React.useRef(onNotification);
  React.useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  React.useEffect(() => {
    if (!enabled || !userId || !condoId) {
      setReady(false);
      return;
    }

    const cfg: RealtimeConnectConfig = { baseUrl, condoId, userId };
    const socket = connectRealtime(cfg);
    setReady(true);

    const detach = attachThreadListeners(qc, api, socket, (payload) =>
      onNotificationRef.current?.(payload),
    );

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
