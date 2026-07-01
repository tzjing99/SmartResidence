import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
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

  /** Join a thread room while viewing a conversation (resident + management detail). */
  @SubscribeMessage('thread:join')
  handleThreadJoin(client: Socket, payload: { threadId?: string }) {
    const threadId = payload?.threadId;
    if (threadId) {
      void client.join(`thread:${threadId}`);
      this.logger.debug(`Socket ${client.id} joined thread:${threadId}`);
    }
  }

  @SubscribeMessage('thread:leave')
  handleThreadLeave(client: Socket, payload: { threadId?: string }) {
    const threadId = payload?.threadId;
    if (threadId) {
      void client.leave(`thread:${threadId}`);
      this.logger.debug(`Socket ${client.id} left thread:${threadId}`);
    }
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

  @OnEvent('booking.*')
  bookingEvent(payload: { condoId: string; bookingId: string; userId?: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('booking:update', payload);
    if (payload.userId) {
      this.server.to(`user:${payload.userId}`).emit('booking:update', payload);
    }
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

  @OnEvent('sos.*')
  sosEvent(payload: { condoId: string; sosId: string; raisedByUserId?: string }) {
    // Fan the SOS event to every management/guard dashboard in the condo, plus
    // the raiser's own devices so their alert status updates live.
    this.server.to(`condo:${payload.condoId}`).emit('sos:update', payload);
    if (payload.raisedByUserId) {
      this.server.to(`user:${payload.raisedByUserId}`).emit('sos:update', payload);
    }
  }

  @OnEvent('patrol.*')
  patrolEvent(payload: { condoId: string; checkpointId?: string; scanId?: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('patrol:update', payload);
  }

  @OnEvent('parcel.*')
  parcelEvent(payload: { condoId: string; parcelId: string; unitId?: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('parcel:update', payload);
  }

  @OnEvent('lostfound.*')
  lostFoundEvent(payload: { condoId: string; postId: string; userId?: string }) {
    this.server.to(`condo:${payload.condoId}`).emit('lostfound:update', payload);
    if (payload.userId) {
      this.server.to(`user:${payload.userId}`).emit('lostfound:update', payload);
    }
  }

  @OnEvent('form.*')
  formEvent(payload: {
    condoId: string;
    submissionId: string;
    userId?: string;
    status?: string;
  }) {
    this.server.to(`condo:${payload.condoId}`).emit('form:update', payload);
    if (payload.userId) {
      this.server.to(`user:${payload.userId}`).emit('form:update', payload);
    }
  }

  @OnEvent('notification.created')
  notificationCreated(payload: {
    userId: string;
    kind: string;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  }) {
    this.server.to(`user:${payload.userId}`).emit('notification:new', payload);
  }
}
