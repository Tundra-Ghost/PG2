import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromWire, toWire, type Color, type WireGameState } from '@pigeon-chess/game-core';
import type { Room } from './rooms';

/**
 * Where rooms are kept between server restarts. The Fly machine sleeps when
 * idle, so without a store every open game is lost on the next wake.
 */
export interface RoomStore {
  loadAll(): Room[];
  save(room: Room): void;
  remove(roomId: string): void;
}

/** Keeps nothing. Used in tests and when no data directory is set. */
export class MemoryStore implements RoomStore {
  loadAll(): Room[] {
    return [];
  }
  save(): void {}
  remove(): void {}
}

interface SavedRoom {
  id: string;
  state: WireGameState;
  seats: Partial<Record<Color, { token: string }>>;
  drawOffer: Color | null;
  updatedAt: number;
}

/** One JSON file per room. Writes go to a temp file first, then rename. */
export class FileStore implements RoomStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  loadAll(): Room[] {
    const rooms: Room[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const saved = JSON.parse(readFileSync(join(this.dir, name), 'utf8')) as SavedRoom;
        rooms.push({
          id: saved.id,
          state: fromWire(saved.state),
          // Nobody is connected right after a restart.
          seats: Object.fromEntries(
            Object.entries(saved.seats).map(([color, seat]) => [color, { token: seat!.token, connected: false }]),
          ),
          drawOffer: saved.drawOffer,
          updatedAt: saved.updatedAt,
        });
      } catch {
        // A damaged file loses one game, not the whole server.
      }
    }
    return rooms;
  }

  save(room: Room): void {
    const saved: SavedRoom = {
      id: room.id,
      state: toWire(room.state),
      seats: Object.fromEntries(
        Object.entries(room.seats).map(([color, seat]) => [color, { token: seat!.token }]),
      ),
      drawOffer: room.drawOffer,
      updatedAt: room.updatedAt,
    };
    const file = this.file(room.id);
    writeFileSync(`${file}.tmp`, JSON.stringify(saved));
    renameSync(`${file}.tmp`, file);
  }

  remove(roomId: string): void {
    rmSync(this.file(roomId), { force: true });
  }

  private file(roomId: string): string {
    // Room ids come from our own alphabet, but never trust a path segment.
    return join(this.dir, `${roomId.replace(/[^A-Z0-9]/g, '')}.json`);
  }
}
