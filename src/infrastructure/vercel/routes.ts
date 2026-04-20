/**
 * Single source of truth for Vercel REST endpoint paths and versions.
 * Bumping an API version is a deliberate edit in this file.
 *
 * Reference: https://vercel.com/docs/rest-api
 */
export const VERCEL_API_BASE = "https://api.vercel.com";

export const VercelRoutes = {
  currentUser: () => "/v2/user",
  listTeams: () => "/v2/teams?limit=100",
  listProjects: (teamId: string, until?: string) => {
    const params = new URLSearchParams({ teamId, limit: "100" });
    if (until !== undefined) params.set("until", until);
    return `/v9/projects?${params.toString()}`;
  },
  listProjectEnvs: (projectId: string, teamId: string) => {
    const params = new URLSearchParams({ teamId, decrypt: "false" });
    return `/v9/projects/${encodeURIComponent(projectId)}/env?${params.toString()}`;
  },
  updateProjectEnv: (projectId: string, envId: string, teamId: string) => {
    const params = new URLSearchParams({ teamId });
    return `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}?${params.toString()}`;
  },
  createAuthToken: (teamId: string | null) => {
    if (teamId === null) return "/v3/user/tokens";
    const params = new URLSearchParams({ teamId });
    return `/v3/user/tokens?${params.toString()}`;
  },
} as const;
