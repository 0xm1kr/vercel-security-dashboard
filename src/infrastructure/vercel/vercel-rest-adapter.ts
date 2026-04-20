import type {
  RemoteEnvBinding,
  UpsertEnvValueInput,
  VercelPort,
  VercelTeamSummary,
  VercelUser,
} from "../../application/ports/vercel-port.js";
import type { Project } from "../../domain/inventory/project.js";
import type { ProjectId, TeamId } from "../../domain/shared/ids.js";
import { executeVercelRequest } from "./http-executor.js";
import {
  mapCreateAuthTokenResponse,
  mapVercelEnvBindings,
  mapVercelProjectsPage,
  mapVercelTeams,
  mapVercelUser,
} from "./mappers.js";
import { VercelRoutes } from "./routes.js";

/**
 * Concrete implementation of the {@link VercelPort} backed by the
 * Vercel HTTPS REST API. Has no dependency on any Vercel-published
 * npm package.
 */
export class VercelRestAdapter implements VercelPort {
  async getCurrentUser(token: string): Promise<VercelUser> {
    const res = await executeVercelRequest(VercelRoutes.currentUser(), { token });
    return mapVercelUser(res.body);
  }

  async listTeams(token: string): Promise<readonly VercelTeamSummary[]> {
    const res = await executeVercelRequest(VercelRoutes.listTeams(), { token });
    return mapVercelTeams(res.body);
  }

  async listProjects(
    token: string,
    teamId: TeamId,
  ): Promise<readonly Project[]> {
    const collected: Project[] = [];
    let until: string | undefined;
    // Hard cap to avoid infinite loops if the API behaves unexpectedly.
    for (let pages = 0; pages < 200; pages++) {
      const res = await executeVercelRequest(
        VercelRoutes.listProjects(teamId, until),
        { token },
      );
      const page = mapVercelProjectsPage(res.body, teamId);
      collected.push(...page.projects);
      if (page.nextUntil === null || page.projects.length === 0) {
        return collected;
      }
      until = page.nextUntil;
    }
    return collected;
  }

  async listEnvBindings(
    token: string,
    teamId: TeamId,
    projectId: ProjectId,
  ): Promise<readonly RemoteEnvBinding[]> {
    const res = await executeVercelRequest(
      VercelRoutes.listProjectEnvs(projectId, teamId),
      { token },
    );
    return mapVercelEnvBindings(res.body);
  }

  async updateEnvValue(
    token: string,
    input: UpsertEnvValueInput,
  ): Promise<number> {
    // Convert Buffer -> string at the last possible moment, then drop
    // the reference. Caller still owns the Buffer and is responsible
    // for zeroing it after this call returns.
    const valueStr = input.value.toString("utf8");
    try {
      const body: Record<string, unknown> = {
        value: valueStr,
        type: input.type,
        target: [...input.targets],
      };
      if (input.gitBranch !== null) body["gitBranch"] = input.gitBranch;

      const res = await executeVercelRequest(
        VercelRoutes.updateProjectEnv(input.projectId, input.remoteId, input.teamId),
        { token, method: "PATCH", body },
      );
      return res.status;
    } finally {
      // We cannot wipe a JS string, but we can drop our reference;
      // the original Buffer is the only authoritative copy and is
      // zeroed by the caller (see RotateEnvBindingUseCase).
    }
  }

  async createAuthToken(
    token: string,
    name: string,
    teamId: TeamId | null,
  ): Promise<string> {
    const res = await executeVercelRequest(
      VercelRoutes.createAuthToken(teamId),
      { token, method: "POST", body: { name } },
    );
    return mapCreateAuthTokenResponse(res.body);
  }
}
