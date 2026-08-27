import { Injectable } from '@nestjs/common';
import { Role } from '../generated/prisma/client';

export type PresenceEntry = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  lastSeen: number;
};

const STALE_MS = 45_000;

@Injectable()
export class PresenceService {
  private readonly sessions = new Map<string, PresenceEntry>();

  touch(entry: Omit<PresenceEntry, 'lastSeen'>): void {
    this.sessions.set(entry.userId, { ...entry, lastSeen: Date.now() });
  }

  leave(userId: string): void {
    this.sessions.delete(userId);
  }

  listActive(maxAgeMs = STALE_MS): PresenceEntry[] {
    const cutoff = Date.now() - maxAgeMs;
    const active: PresenceEntry[] = [];

    for (const [userId, entry] of this.sessions) {
      if (entry.lastSeen < cutoff) {
        this.sessions.delete(userId);
        continue;
      }
      active.push(entry);
    }

    return active.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}
