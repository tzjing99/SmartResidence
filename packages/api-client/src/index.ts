export * from './client';
export * from './hooks';
// Realtime (Socket.IO) is exported only from `@smartresidence/api-client/realtime`
// so shell and page imports do not pull socket.io-client into every route bundle.
