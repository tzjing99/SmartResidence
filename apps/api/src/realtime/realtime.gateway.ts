import { AuthService } from '@/auth/auth.service';
import { TokenService } from '@/auth/token.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { resolveCorsOrigins } from '@/config/cors-origins';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { RoleId } from '@prisma/client';
import type { Server, Socket } from 'socket.io';

interface AuthedSocketData {
  user: AuthenticatedUser;
}

/**
 * Per-condo Socket.IO rooms. Clients must authenticate with a valid access
 * token (handshake `auth.token`, matching the REST API's Bearer token) —
 * room membership is derived from the verified user's role assignments, not
 * from client-supplied `condoId`/`userId` query params, otherwise any
 * unauthenticated client could eavesdrop on another condo/user's live
 * visitor, defect, SOS, thread, and notification events just by guessing ids.
 *
 * Domain events emitted by the EventEmitter (visitor.created etc.) are
 * relayed into the matching room so connected dashboards / mobile apps
 * update in real time.
 */
@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: resolveCorsOrigins(), credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() server!: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Socket ${client.id} rejected: missing access token`);
      client.disconnect(true);
      return;
    }

    let user: AuthenticatedUser;
    try {
      const claims = await this.tokens.verifyAccessToken(token);
      user = await this.auth.loadUser(claims.sub);
    } catch (err) {
      this.logger.warn(`Socket ${client.id} rejected: ${(err as Error).message}`);
      client.disconnect(true);
      return;
    }

    (client.data as AuthedSocketData).user = user;

    // Own-user room so resident-scoped events (e.g. thread replies) reach
    // only the authenticated participant, never a client-supplied userId.
    void client.join(`user:${user.id}`);

    const isSuperAdmin = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    const ownCondoIds = new Set(
      user.roles.map((r) => r.condoId).filter((id): id is string => !!id),
    );
    if (isSuperAdmin) {
      // Platform admins aren't scoped to a condoId via role assignments; only
      // let them subscribe to the specific condo their dashboard requested.
      const requestedCondoId = client.handshake.query.condoId as string | undefined;
      if (requestedCondoId) ownCondoIds.add(requestedCondoId);
    }
    for (const condoId of ownCondoIds) {
      void client.join(`condo:${condoId}`);
    }
    this.logger.debug(`Socket ${client.id} authenticated as user:${user.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (typeof authToken === 'string' && authToken) return authToken;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return null;
  }

  /** Join a thread room while viewing a conversation (resident + management detail). */
  @SubscribeMessage('thread:join')
  handleThreadJoin(client: Socket, payload: { threadId?: string }) {
    if (!(client.data as Partial<AuthedSocketData>).user) return;
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
