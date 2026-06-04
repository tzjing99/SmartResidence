import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, type Socket } from 'socket.io';

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
}
