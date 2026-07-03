import { type Socket, io } from 'socket.io-client';

export interface RealtimeConnectConfig {
  baseUrl: string;
  /** Access token used to authenticate the socket (server derives room membership from it). */
  token: string;
  /** Hint for which condo room to join if the caller is a platform (super admin) user. */
  condoId?: string;
}

let sharedSocket: Socket | null = null;
let sharedKey: string | null = null;

/** Singleton Socket.IO client for the `/realtime` namespace. */
export function connectRealtime(cfg: RealtimeConnectConfig): Socket {
  const key = `${cfg.baseUrl}|${cfg.token}|${cfg.condoId ?? ''}`;
  if (sharedSocket && sharedKey === key) {
    if (!sharedSocket.connected) sharedSocket.connect();
    return sharedSocket;
  }

  sharedSocket?.disconnect();
  sharedKey = key;
  sharedSocket = io(`${cfg.baseUrl.replace(/\/$/, '')}/realtime`, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelayMax: 5000,
    auth: { token: cfg.token },
    query: cfg.condoId ? { condoId: cfg.condoId } : undefined,
  });

  return sharedSocket;
}

export function disconnectRealtime() {
  sharedSocket?.disconnect();
  sharedSocket = null;
  sharedKey = null;
}

export function getRealtimeSocket(): Socket | null {
  return sharedSocket;
}

export function joinThreadRoom(threadId: string) {
  sharedSocket?.emit('thread:join', { threadId });
}

export function leaveThreadRoom(threadId: string) {
  sharedSocket?.emit('thread:leave', { threadId });
}
