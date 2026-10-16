import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type {
  ActionAck,
  ClientToServerEvents,
  Color,
  GameSummary,
  RoomAck,
  ServerToClientEvents,
} from '@pigeon-chess/game-core';
import { RoomManager } from './rooms';
import type { RoomStore } from './store';

export interface ServerOptions {
  /** Origins allowed to open a socket. The Vite dev server by default. */
  corsOrigin?: string | string[];
  logger?: boolean;
  /** Where rooms are saved between restarts. In-memory when left out. */
  store?: RoomStore;
}

export interface GameServer {
  app: FastifyInstance;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  rooms: RoomManager;
}

type Ack<T> = (res: T) => void;

/** Clients are untrusted: a missing callback must not crash the server. */
function safeAck<T>(ack: unknown): Ack<T> {
  return typeof ack === 'function' ? (ack as Ack<T>) : () => {};
}

interface SocketSeat {
  roomId: string;
  color: Color;
}

export function createGameServer(options: ServerOptions = {}): GameServer {
  const app = Fastify({ logger: options.logger ?? false });
  const rooms = new RoomManager(options.store);
  // Sweep long-idle rooms once an hour.
  const sweep = setInterval(() => rooms.expireOld(), 60 * 60 * 1000);
  sweep.unref();
  app.addHook('onClose', async () => clearInterval(sweep));
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: options.corsOrigin ?? 'http://localhost:5173' },
  });

  app.get('/health', async () => ({ ok: true }));

  const broadcast = (roomId: string) => {
    const snapshot = rooms.snapshot(roomId);
    if (snapshot) io.to(roomId).emit('game:state', snapshot);
  };

  io.on('connection', socket => {
    let seat: SocketSeat | null = null;

    const takeSeat = (roomId: string, color: Color) => {
      seat = { roomId, color };
      void socket.join(roomId);
      broadcast(roomId);
    };

    socket.on('room:create', rawAck => {
      const ack = safeAck<RoomAck>(rawAck);
      if (seat) return ack({ ok: false, reason: 'Already in a room.' });
      const res = rooms.create();
      ack(res);
      if (res.ok) takeSeat(res.roomId, res.color);
    });

    socket.on('room:join', (req, rawAck) => {
      const ack = safeAck<RoomAck>(rawAck);
      if (seat) return ack({ ok: false, reason: 'Already in a room.' });
      const res = rooms.join(String(req?.roomId ?? ''), req?.token);
      ack(res);
      if (res.ok) takeSeat(res.roomId, res.color);
    });

    socket.on('room:list', (seats, rawAck) => {
      const ack = safeAck<GameSummary[]>(rawAck);
      ack(Array.isArray(seats) ? rooms.summaries(seats) : []);
    });

    socket.on('game:move', (req, rawAck) => {
      const ack = safeAck<ActionAck>(rawAck);
      if (!seat) return ack({ ok: false, reason: 'Join a room first.' });
      if (!req || typeof req.from !== 'string' || typeof req.to !== 'string') {
        return ack({ ok: false, reason: 'Bad move request.' });
      }
      const res = rooms.move(seat.roomId, seat.color, req);
      ack(res);
      if (res.ok) broadcast(seat.roomId);
    });

    socket.on('game:shoo_gerald', rawAck => {
      const ack = safeAck<ActionAck>(rawAck);
      if (!seat) return ack({ ok: false, reason: 'Join a room first.' });
      const res = rooms.shooGerald(seat.roomId, seat.color);
      ack(res);
      if (res.ok) broadcast(seat.roomId);
    });

    socket.on('game:resign', rawAck => {
      const ack = safeAck<ActionAck>(rawAck);
      if (!seat) return ack({ ok: false, reason: 'Join a room first.' });
      const res = rooms.resign(seat.roomId, seat.color);
      ack(res);
      if (res.ok) broadcast(seat.roomId);
    });

    socket.on('game:draw_offer', (req, rawAck) => {
      const ack = safeAck<ActionAck>(rawAck);
      if (!seat) return ack({ ok: false, reason: 'Join a room first.' });
      const accept = typeof req?.accept === 'boolean' ? req.accept : undefined;
      const res = rooms.drawOffer(seat.roomId, seat.color, { accept });
      ack(res);
      if (res.ok) broadcast(seat.roomId);
    });

    socket.on('disconnect', () => {
      if (!seat) return;
      rooms.setConnected(seat.roomId, seat.color, false);
      broadcast(seat.roomId);
      rooms.closeIfEmpty(seat.roomId);
    });
  });

  return { app, io, rooms };
}
