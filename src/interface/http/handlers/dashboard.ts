import { ConflictError } from "../../../domain/shared/errors.js";
import { toDashboardDto } from "./dto.js";
import type { Handler } from "./types.js";

export const dashboardHandler: Handler = async ({ ctx }) => {
  const profile = await ctx.credentials.getProfile();
  if (profile === null) {
    throw new ConflictError("Onboarding has not been completed yet");
  }
  const data = await ctx.getDashboardData.execute(profile.teamId);
  return { type: "json", body: toDashboardDto(data) };
};
