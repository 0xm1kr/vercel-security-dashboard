import { ConflictError } from "../../../domain/shared/errors.js";
import type { Handler } from "./types.js";

export const runScanHandler: Handler = async ({ ctx, sessionId }) => {
  const profile = await ctx.credentials.getProfile();
  if (profile === null) {
    throw new ConflictError("Onboarding has not been completed yet");
  }
  const token = ctx.sessions.useToken(sessionId);
  const result = await ctx.runScan.execute({ token, teamId: profile.teamId });
  return {
    type: "json",
    body: {
      ok: true,
      scanId: result.scanId,
      projectsScanned: result.projectsScanned,
      bindingsSeen: result.bindingsSeen,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
    },
  };
};
