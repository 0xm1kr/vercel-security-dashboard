import type { Handler } from "./types.js";

export const profileHandler: Handler = async ({ ctx, sessionId }) => {
  const profile = await ctx.credentials.getProfile();
  const hasToken = await ctx.credentials.hasToken();
  const session = ctx.sessions.peek(sessionId);
  return {
    type: "json",
    body: {
      hasToken,
      profile:
        profile === null
          ? null
          : {
              teamId: profile.teamId,
              teamName: profile.teamName,
              createdAt: profile.createdAt,
            },
      session:
        session === null
          ? null
          : { createdAt: session.createdAt, expiresAt: session.expiresAt },
    },
  };
};
