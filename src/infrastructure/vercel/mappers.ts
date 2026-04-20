import type { Project } from "../../domain/inventory/project.js";
import type {
  EnvBindingType,
} from "../../domain/inventory/env-binding.js";
import type { RemoteEnvBinding, VercelTeamSummary, VercelUser } from "../../application/ports/vercel-port.js";
import { ProjectId, TeamId } from "../../domain/shared/ids.js";
import { ALL_TARGETS, type Target } from "../../domain/shared/target.js";

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const stringOr = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

const stringOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

const numberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const ENV_TYPE_MAP: Record<string, EnvBindingType> = {
  plain: "plain",
  secret: "secret",
  encrypted: "encrypted",
  system: "system",
  sensitive: "sensitive",
};

const mapEnvType = (raw: unknown): EnvBindingType => {
  if (typeof raw === "string" && raw in ENV_TYPE_MAP) {
    return ENV_TYPE_MAP[raw] as EnvBindingType;
  }
  return "other";
};

const mapTargets = (raw: unknown): Target[] => {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(ALL_TARGETS);
  const seen = new Set<Target>();
  for (const value of raw) {
    if (typeof value === "string" && allowed.has(value)) {
      seen.add(value as Target);
    }
  }
  return ALL_TARGETS.filter((t) => seen.has(t));
};

export const mapVercelUser = (raw: unknown): VercelUser => {
  if (!isObject(raw)) {
    throw new Error("Unexpected /v2/user response shape");
  }
  const user = isObject(raw["user"]) ? raw["user"] : raw;
  return {
    id: stringOr(user["id"] ?? user["uid"], ""),
    username: stringOr(user["username"], ""),
    email: stringOrNull(user["email"]),
  };
};

export const mapVercelTeams = (raw: unknown): VercelTeamSummary[] => {
  if (!isObject(raw)) return [];
  const teams = raw["teams"];
  if (!Array.isArray(teams)) return [];
  const out: VercelTeamSummary[] = [];
  for (const t of teams) {
    if (!isObject(t)) continue;
    const id = stringOrNull(t["id"]);
    if (id === null) continue;
    out.push({
      id: TeamId(id),
      name: stringOr(t["name"], stringOr(t["slug"], id)),
      slug: stringOr(t["slug"], id),
    });
  }
  return out;
};

interface VercelProjectsPage {
  readonly projects: Project[];
  readonly nextUntil: string | null;
}

export const mapVercelProjectsPage = (
  raw: unknown,
  teamId: string,
): VercelProjectsPage => {
  if (!isObject(raw)) {
    return { projects: [], nextUntil: null };
  }
  const projectsRaw = raw["projects"];
  const projects: Project[] = [];
  if (Array.isArray(projectsRaw)) {
    for (const p of projectsRaw) {
      if (!isObject(p)) continue;
      const id = stringOrNull(p["id"]);
      if (id === null) continue;
      projects.push({
        id: ProjectId(id),
        teamId: TeamId(teamId),
        name: stringOr(p["name"], id),
        framework: stringOrNull(p["framework"]),
        updatedAt: numberOrNull(p["updatedAt"]) ?? 0,
      });
    }
  }
  const pagination = isObject(raw["pagination"]) ? raw["pagination"] : null;
  const next =
    pagination !== null && pagination["next"] !== null && pagination["next"] !== undefined
      ? String(pagination["next"])
      : null;
  return { projects, nextUntil: next };
};

export const mapVercelEnvBindings = (raw: unknown): RemoteEnvBinding[] => {
  if (!isObject(raw)) return [];
  const envs = raw["envs"];
  if (!Array.isArray(envs)) return [];
  const out: RemoteEnvBinding[] = [];
  for (const e of envs) {
    if (!isObject(e)) continue;
    const remoteId = stringOrNull(e["id"]);
    const key = stringOrNull(e["key"]);
    if (remoteId === null || key === null) continue;
    out.push({
      remoteId,
      key,
      targets: mapTargets(e["target"]),
      gitBranch: stringOrNull(e["gitBranch"]),
      type: mapEnvType(e["type"]),
      remoteCreatedAt: numberOrNull(e["createdAt"]),
      remoteUpdatedAt: numberOrNull(e["updatedAt"]),
    });
  }
  return out;
};

export const mapCreateAuthTokenResponse = (raw: unknown): string => {
  if (!isObject(raw)) {
    throw new Error("Unexpected /v3/user/tokens response shape");
  }
  const bearer = stringOrNull(raw["bearerToken"]);
  if (bearer === null) {
    throw new Error("Vercel response missing bearerToken");
  }
  return bearer;
};

export const __test = {
  mapEnvType,
  mapTargets,
};
