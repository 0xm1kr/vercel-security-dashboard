import { randomBytes } from "node:crypto";
import { UnauthorizedError } from "../../domain/shared/errors.js";

export interface SessionRecord {
  readonly token: Buffer;
  readonly createdAt: number;
  readonly absoluteExpiresAt: number;
  expiresAt: number;
}

export interface SessionInfo {
  readonly id: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly absoluteExpiresAt: number;
}

const COOKIE_NAME = "vsd_session";
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour sliding
const SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hour hard cap

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  create(token: string): SessionInfo {
    const id = randomBytes(32).toString("hex");
    const tokenBuffer = Buffer.from(token, "utf8");
    const createdAt = Date.now();
    const absoluteExpiresAt = createdAt + SESSION_ABSOLUTE_TTL_MS;
    const expiresAt = Math.min(createdAt + SESSION_TTL_MS, absoluteExpiresAt);
    this.sessions.set(id, {
      token: tokenBuffer,
      createdAt,
      expiresAt,
      absoluteExpiresAt,
    });
    return { id, createdAt, expiresAt, absoluteExpiresAt };
  }

  /**
   * Returns the bearer token for the given session id, sliding the
   * expiration window forward (but never past the absolute cap).
   * Throws if the session is missing or expired.
   */
  useToken(id: string | null): string {
    if (id === null) throw new UnauthorizedError("Session is locked");
    const record = this.sessions.get(id);
    if (record === undefined) throw new UnauthorizedError("Session is locked");
    const now = Date.now();
    if (now > record.expiresAt || now > record.absoluteExpiresAt) {
      this.destroy(id);
      throw new UnauthorizedError("Session has expired");
    }
    record.expiresAt = Math.min(now + SESSION_TTL_MS, record.absoluteExpiresAt);
    return record.token.toString("utf8");
  }

  peek(id: string | null): SessionInfo | null {
    if (id === null) return null;
    const record = this.sessions.get(id);
    if (record === undefined) return null;
    const now = Date.now();
    if (now > record.expiresAt || now > record.absoluteExpiresAt) {
      this.destroy(id);
      return null;
    }
    return {
      id,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    };
  }

  destroy(id: string | null): void {
    if (id === null) return;
    const record = this.sessions.get(id);
    if (record !== undefined) {
      record.token.fill(0);
      this.sessions.delete(id);
    }
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

export const buildSessionCookie = (id: string, expiresAt: number): string => {
  const expires = new Date(expiresAt).toUTCString();
  return `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`;
};

export const buildClearedSessionCookie = (): string =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export const parseSessionCookie = (cookieHeader: string | undefined): string | null => {
  if (cookieHeader === undefined) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq);
    if (name === COOKIE_NAME) {
      return trimmed.slice(eq + 1);
    }
  }
  return null;
};
