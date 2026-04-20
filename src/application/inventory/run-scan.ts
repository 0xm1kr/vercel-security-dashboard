import {
  bindingMetadataFingerprint,
  type EnvBinding,
} from "../../domain/inventory/env-binding.js";
import type { DiffEvent } from "../../domain/inventory/diff-event.js";
import type { Project } from "../../domain/inventory/project.js";
import type { Scan } from "../../domain/inventory/scan.js";
import {
  EnvBindingId,
  EnvKey,
  RemoteEnvId,
  ScanId,
  type TeamId,
} from "../../domain/shared/ids.js";
import type { Clock } from "../ports/clock.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { InventoryRepository } from "../ports/inventory-repository.js";
import type { ScanRepository } from "../ports/scan-repository.js";
import type { VendorRuleSource } from "../ports/vendor-rule-source.js";
import type {
  RemoteEnvBinding,
  VercelPort,
} from "../ports/vercel-port.js";
import { classify } from "../../domain/classification/classifier.js";
import type { CompiledVendorRule } from "../../domain/classification/vendor-rule.js";
import { LoadVendorRulesUseCase } from "../classification/load-vendor-rules.js";

export interface RunScanInput {
  readonly token: string;
  readonly teamId: TeamId;
}

export interface RunScanResult {
  readonly scanId: ScanId;
  readonly projectsScanned: number;
  readonly bindingsSeen: number;
  readonly added: number;
  readonly updated: number;
  readonly removed: number;
}

interface ExistingBindingIndex {
  readonly byRemoteId: Map<string, EnvBinding>;
}

const indexBindings = (bindings: readonly EnvBinding[]): ExistingBindingIndex => {
  const byRemoteId = new Map<string, EnvBinding>();
  for (const b of bindings) byRemoteId.set(b.remoteId, b);
  return { byRemoteId };
};

const summarizeUpdate = (before: EnvBinding, after: EnvBinding): string => {
  const parts: string[] = [];
  if (before.type !== after.type) {
    parts.push(`type: ${before.type} -> ${after.type}`);
  }
  if (before.gitBranch !== after.gitBranch) {
    parts.push(`branch: ${String(before.gitBranch)} -> ${String(after.gitBranch)}`);
  }
  const beforeTargets = before.targets.join(",");
  const afterTargets = after.targets.join(",");
  if (beforeTargets !== afterTargets) {
    parts.push(`targets: [${beforeTargets}] -> [${afterTargets}]`);
  }
  return parts.length === 0 ? "metadata changed" : parts.join("; ");
};

const buildBinding = (
  existing: EnvBinding | undefined,
  remote: RemoteEnvBinding,
  scanId: ScanId,
  teamId: TeamId,
  projectId: Project["id"],
  ids: IdGenerator,
): EnvBinding => {
  const key = EnvKey(remote.key);
  if (existing !== undefined) {
    return {
      id: existing.id,
      remoteId: RemoteEnvId(remote.remoteId),
      teamId,
      projectId,
      key,
      targets: remote.targets,
      gitBranch: remote.gitBranch,
      type: remote.type,
      remoteCreatedAt: remote.remoteCreatedAt,
      remoteUpdatedAt: remote.remoteUpdatedAt,
      lastSeenScanId: scanId,
      // If a previously rotated binding's metadata changes, we keep
      // the rotated state. The repo SQL re-arms a 'superseded' row
      // back to 'never' if Vercel returns it again.
      rotationStatus: existing.rotationStatus,
      rotatedAt: existing.rotatedAt,
    };
  }
  return {
    id: EnvBindingId(ids.next()),
    remoteId: RemoteEnvId(remote.remoteId),
    teamId,
    projectId,
    key,
    targets: remote.targets,
    gitBranch: remote.gitBranch,
    type: remote.type,
    remoteCreatedAt: remote.remoteCreatedAt,
    remoteUpdatedAt: remote.remoteUpdatedAt,
    lastSeenScanId: scanId,
    rotationStatus: "never",
    rotatedAt: null,
  };
};

const collectUnmatchedKeys = (
  bindings: readonly EnvBinding[],
  rules: readonly CompiledVendorRule[],
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const b of bindings) {
    const result = classify(b.key, rules);
    if (result.primary === null) {
      counts.set(b.key, (counts.get(b.key) ?? 0) + 1);
    }
  }
  return counts;
};

/**
 * Org-scoped scan. Lists every project + env binding, persists them,
 * computes diff events vs the last snapshot, marks vanished bindings
 * as superseded, and writes a suggestions file for unmatched keys.
 */
export class RunScanUseCase {
  constructor(
    private readonly vercel: VercelPort,
    private readonly inventory: InventoryRepository,
    private readonly scans: ScanRepository,
    private readonly ruleSource: VendorRuleSource,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RunScanInput): Promise<RunScanResult> {
    const scanId = ScanId(this.ids.next());
    const startedAt = this.clock.now();
    const scan: Scan = {
      id: scanId,
      teamId: input.teamId,
      startedAt,
      finishedAt: null,
      status: "running",
      projectsScanned: 0,
      bindingsSeen: 0,
      errorMessage: null,
    };
    await this.scans.start(scan);

    try {
      const existing = await this.inventory.listBindings(input.teamId);
      const index = indexBindings(existing);

      const projects = await this.vercel.listProjects(input.token, input.teamId);
      await this.inventory.upsertProjects(projects);

      const newBindings: EnvBinding[] = [];
      const diffs: DiffEvent[] = [];
      let added = 0;
      let updated = 0;

      for (const project of projects) {
        const remoteBindings = await this.vercel.listEnvBindings(
          input.token,
          input.teamId,
          project.id,
        );
        for (const remote of remoteBindings) {
          const prior = index.byRemoteId.get(remote.remoteId);
          const next = buildBinding(
            prior,
            remote,
            scanId,
            input.teamId,
            project.id,
            this.ids,
          );
          newBindings.push(next);
          if (prior === undefined) {
            added++;
            diffs.push({
              scanId,
              bindingId: next.id,
              kind: "added",
              summary: `discovered key ${next.key}`,
              at: this.clock.now(),
            });
          } else if (
            bindingMetadataFingerprint(prior) !==
            bindingMetadataFingerprint(next)
          ) {
            updated++;
            diffs.push({
              scanId,
              bindingId: next.id,
              kind: "updated",
              summary: summarizeUpdate(prior, next),
              at: this.clock.now(),
            });
          }
        }
      }

      await this.inventory.upsertBindings(newBindings);

      const stale = await this.inventory.markStaleAsSuperseded(input.teamId, scanId);
      for (const id of stale) {
        diffs.push({
          scanId,
          bindingId: id,
          kind: "removed",
          summary: "no longer present on Vercel",
          at: this.clock.now(),
        });
      }
      if (diffs.length > 0) {
        await this.inventory.appendDiffEvents(diffs);
      }

      const ruleLoader = new LoadVendorRulesUseCase(this.ruleSource);
      const { compiled } = await ruleLoader.execute();
      const unmatched = collectUnmatchedKeys(newBindings, compiled);
      await this.ruleSource.writeSuggestions(unmatched);

      await this.scans.finish(
        scanId,
        "succeeded",
        this.clock.now(),
        projects.length,
        newBindings.length,
        null,
      );

      return {
        scanId,
        projectsScanned: projects.length,
        bindingsSeen: newBindings.length,
        added,
        updated,
        removed: stale.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      await this.scans.finish(scanId, "failed", this.clock.now(), 0, 0, message);
      throw err;
    }
  }
}
