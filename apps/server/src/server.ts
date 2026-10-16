import cors from '@fastify/cors';
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
import { registerAccountRoutes, type Accounts } from './accounts';
import { createFeedbackStore, registerFeedbackRoutes } from './feedback';
import { RoomManager, type Player } from './rooms';
import type { RoomStore } from './store';

export interface ServerOptions {
  /** Origins allowed to open a socket. The Vite dev server by default. */
  corsOrigin?: string | string[];
  logger?: boolean;
  /** Where rooms are saved between restarts. In-memory when left out. */
  store?: RoomStore;
  /** Player accounts and profile sync. Left out, the account routes don't exist. */
  accounts?: Accounts;
}

export interface GameServer {
  app: FastifyInstance;
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  rooms: RoomManager;
}

type Ack<T> = (res: T) => void;

interface SocketData {
  /** Set when the socket connected with a valid account session. */
  player?: Player;
}

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
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(app.server, {
    cors: { origin: options.corsOrigin ?? 'http://localhost:5173' },
  });

  // A signed-in client sends its session token on connect. A missing or
  // dead token just means a guest: guests can still play by room code.
  const accounts = options.accounts;
  if (accounts) {
    io.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next();
      accounts
        .playerFor(token)
        .then(player => {
          if (player) socket.data.player = player;
          next();
        })
        .catch(() => next());
    });
  }

  app.get('/health', async () => ({ ok: true }));

  if (options.accounts) {
    // Sessions travel in the Authorization header, so the browser needs CORS
    // for it; set-auth-token is how Better Auth hands back a fresh token.
    void app.register(cors, {
      origin: options.corsOrigin ?? 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['set-auth-token'],
    });
    registerAccountRoutes(app, options.accounts);
    registerFeedbackRoutes(app, createFeedbackStore(options.accounts.db), options.accounts);
  }

  const broadcast = (roomId: string) => {
    const snapshot = rooms.snapshot(roomId);
    if (snapshot) io.to(roomId).emit('game:state', snapshot);
  };

  io.on('connection', socket => {
    let seat: SocketSeat | null = null;

    const takeSeat = (roomId: string, color: Color) => {
      seat = { roomId, color };
      void socket.join(roomId);
      socket.emit('chat:history', rooms.chatHistory(roomId));
      broadcast(roomId);
    };

    socket.on('room:create', rawAck => {
      const ack = safeAck<RoomAck>(rawAck);
      if (seat) return ack({ ok: false, reason: 'Already in a room.' });
      const res = rooms.create(socket.data.player);
      ack(res);
      if (res.ok) takeSeat(res.roomId, res.color);
    });

    socket.on('room:join', (req, rawAck) => {
      const ack = safeAck<RoomAck>(rawAck);
      if (seat) return ack({ ok: false, reason: 'Already in a room.' });
      const res = rooms.join(String(req?.roomId ?? ''), req?.token, socket.data.player);
      ack(res);
      if (res.ok) takeSeat(res.roomId, res.color);
    });

    socket.on('room:list', (seats, rawAck) => {
      const ack = safeAck<GameSummary[]>(rawAck);
      ack(rooms.summaries(Array.isArray(seats) ? seats : [], socket.data.player));
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

    socket.on('chat:send', (req, rawAck) => {
      const ack = safeAck<ActionAck>(rawAck);
      if (!seat) return ack({ ok: false, reason: 'Join a room first.' });
      const res = rooms.chat(seat.roomId, seat.color, req?.text);
      if (!res.ok) return ack(res);
      ack({ ok: true });
      io.to(seat.roomId).emit('chat:message', res.message);
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
