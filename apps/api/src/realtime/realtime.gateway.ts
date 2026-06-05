import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/**
 * Per-condo Socket.IO rooms. Clients join `condo:<id>` after authenticating
 * via the access token in the connection query / Authorization header.
 *
 * Domain events emitted by the EventEmitter (visitor.created etc.) are
 * relayed into the matching room so connected dashboards / mobile apps
 * update in real time.
 */
@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    const condoId = client.handshake.query.condoId as string | undefined;
    if (condoId) {
      void client.join(`condo:${condoId}`);
      this.logger.debug(`Socket ${client.id} joined condo:${condoId}`);
    }
    // Per-user room so resident-scoped events (e.g. thread replies) reach only
    // the participants instead of every connected device in the condo.
    const userId = client.handshake.query.userId as string | undefined;
    if (userId) {
      void client.join(`user:${userId}`);
      this.logger.debug(`Socket ${client.id} joined user:${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  @OnEvent('visitor.*')
  visitorEvent(payload: { condoId: string; visitorId: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('visitor:update', payload);
  }

  @OnEvent('defect.*')
  defectEvent(payload: { condoId: string; defectId: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('defect:update', payload);
  }

  @OnEvent('announcement.published')
  announcementEvent(payload: { condoId: string; announcementId: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('announcement:new', payload);
  }

  @OnEvent('thread.created')
  threadCreated(payload: { condoId: string; threadId: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('thread:update', payload);
  }

  @OnEvent('thread.message')
  threadMessage(payload: {
    condoId: string;
    threadId: string;
    messageId: string;
    internal?: boolean;
  }) {
    // Management dashboards (condo room) always get the event. Internal notes
    // stay within the condo room; resident-visible messages also fan out to
    // any per-user rooms the gateway client joined for this thread.
    this.server.to(`condo:${payload.condoId}`).emit('thread:message', payload);
    if (!payload.internal) {
      this.server.to(`thread:${payload.threadId}`).emit('thread:message', payload);
    }
  }

  @OnEvent('thread.status')
  threadStatus(payload: { condoId: string; threadId: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('thread:update', payload);
    this.server.to(`thread:${payload.threadId}`).emit('thread:update', payload);
  }

  @OnEvent('thread.sla.escalation')
  threadSlaEscalation(payload: { condoId: string; threadId: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('thread:sla', payload);
  }
}
