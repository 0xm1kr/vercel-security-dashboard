import { asObject, readJsonBody, requireString } from "../validation.js";
import { buildClearedSessionCookie, buildSessionCookie } from "../session.js";
import type { Handler } from "./types.js";

const throttleKey = (args: { req: { socket: { remoteAddress?: string | undefined } } }): string => {
  const ip = args.req.socket.remoteAddress ?? "unknown";
  return `unlock:${ip}`;
};

export const unlockSessionHandler: Handler = async ({ req, ctx }) => {
  const key = throttleKey({ req });
  ctx.unlockThrottle.ensureAllowed(key);
  const body = asObject(await readJsonBody(req));
  const passphrase = requireString(body, "passphrase");
  let token: string;
  try {
    token = await ctx.credentials.unlockToken(passphrase);
  } catch (err) {
    ctx.unlockThrottle.recordFailure(key);
    throw err;
  }
  ctx.unlockThrottle.recordSuccess(key);
  const session = ctx.sessions.create(token);
  return {
    type: "json",
    body: {
      ok: true,
      expiresAt: session.expiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    },
    headers: { "Set-Cookie": buildSessionCookie(session.id, session.expiresAt) },
  };
};

export const lockSessionHandler: Handler = async ({ ctx, sessionId }) => {
  ctx.sessions.destroy(sessionId);
  return {
    type: "json",
    body: { ok: true },
    headers: { "Set-Cookie": buildClearedSessionCookie() },
  };
};
