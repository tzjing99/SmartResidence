import { type Socket, io } from 'socket.io-client';

export interface RealtimeConnectConfig {
  baseUrl: string;
  condoId: string;
  userId: string;
}

let sharedSocket: Socket | null = null;
let sharedKey: string | null = null;

/** Singleton Socket.IO client for the `/realtime` namespace. */
export function connectRealtime(cfg: RealtimeConnectConfig): Socket {
  const key = `${cfg.baseUrl}|${cfg.condoId}|${cfg.userId}`;
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
    query: {
      condoId: cfg.condoId,
      userId: cfg.userId,
    },
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
