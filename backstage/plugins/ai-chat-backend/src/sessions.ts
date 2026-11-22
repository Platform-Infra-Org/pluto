import { randomUUID } from 'node:crypto';
import type { ConversationState } from './agent';
type Session = {
  id: string;
  principal: string;
  updatedAt: number;
  busy: boolean;
  state: ConversationState;
};
export class Sessions {
  private readonly records = new Map<string, Session>();
  private readonly ttlMs: number;
  private readonly maxSessions: number;
  constructor(ttlMs = 30 * 60_000, maxSessions = 1000) {
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
  }
  acquire(principal: string, id?: string): Session {
    const now = Date.now();
    for (const [key, s] of this.records)
      if (now - s.updatedAt > this.ttlMs) this.records.delete(key);
    let s = id ? this.records.get(id) : undefined;
    if (id && !s) throw new Error('SESSION_EXPIRED');
    if (s && s.principal !== principal) throw new Error('SESSION_FORBIDDEN');
    if (!s) {
      const ownerSessions = [...this.records.values()].filter(
        x => x.principal === principal,
      );
      if (ownerSessions.length >= 3)
        this.records.delete(
          ownerSessions.sort((a, b) => a.updatedAt - b.updatedAt)[0].id,
        );
      if (this.records.size >= this.maxSessions)
        this.records.delete(
          [...this.records.values()].sort(
            (a, b) => a.updatedAt - b.updatedAt,
          )[0].id,
        );
      s = {
        id: randomUUID(),
        principal,
        updatedAt: now,
        busy: false,
        state: { messages: [], turns: 0 },
      };
      this.records.set(s.id, s);
    }
    if (s.busy) throw new Error('SESSION_BUSY');
    s.busy = true;
    s.updatedAt = now;
    return s;
  }
  /** Forget a temporary conversation immediately, checking its authenticated owner. */
  clear(principal: string, id: string): boolean {
    const current = this.records.get(id);
    if (!current) return false;
    if (current.principal !== principal) throw new Error('SESSION_FORBIDDEN');
    if (current.busy) throw new Error('SESSION_BUSY');
    return this.records.delete(id);
  }
  clearAll(): void {
    this.records.clear();
  }
  finish(s: Session, next?: ConversationState) {
    if (next) s.state = next;
    s.updatedAt = Date.now();
    s.busy = false;
  }
}
