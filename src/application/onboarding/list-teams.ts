import type {
  VercelPort,
  VercelTeamSummary,
} from "../ports/vercel-port.js";

/**
 * Lists Vercel teams visible to the supplied bearer token. The
 * onboarding wizard uses this so the user can pick the team to scan
 * without copying the team id out of the Vercel dashboard.
 */
export class ListTeamsUseCase {
  constructor(private readonly vercel: VercelPort) {}

  async execute(token: string): Promise<readonly VercelTeamSummary[]> {
    return this.vercel.listTeams(token);
  }
}
