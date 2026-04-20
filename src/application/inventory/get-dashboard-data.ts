import { classify } from "../../domain/classification/classifier.js";
import type { ClassificationResult } from "../../domain/classification/classification-result.js";
import type { EnvBinding } from "../../domain/inventory/env-binding.js";
import type { Project } from "../../domain/inventory/project.js";
import type { Scan } from "../../domain/inventory/scan.js";
import type { Vendor } from "../../domain/classification/vendor.js";
import type { TeamId } from "../../domain/shared/ids.js";
import type { InventoryRepository } from "../ports/inventory-repository.js";
import type { ScanRepository } from "../ports/scan-repository.js";
import type { VendorRuleSource } from "../ports/vendor-rule-source.js";
import { LoadVendorRulesUseCase } from "../classification/load-vendor-rules.js";

export interface DashboardBindingRow {
  readonly binding: EnvBinding;
  readonly project: Project;
  readonly classification: ClassificationResult;
  readonly primaryVendor: Vendor | null;
}

export interface DashboardData {
  readonly teamId: TeamId;
  readonly bindings: readonly DashboardBindingRow[];
  readonly projects: readonly Project[];
  readonly vendors: readonly Vendor[];
  readonly recentScans: readonly Scan[];
}

/**
 * Read model for the dashboard. Joins persisted inventory with the
 * (in-memory) classification result. Classification is computed
 * lazily so that updates to vendor rules take effect on next read
 * without requiring a re-scan.
 */
export class GetDashboardDataUseCase {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly scans: ScanRepository,
    private readonly ruleSource: VendorRuleSource,
  ) {}

  async execute(teamId: TeamId): Promise<DashboardData> {
    const [bindings, projects, recentScans, ruleset] = await Promise.all([
      this.inventory.listBindings(teamId),
      this.inventory.listProjects(teamId),
      this.scans.listRecent(teamId, 10),
      new LoadVendorRulesUseCase(this.ruleSource).execute(),
    ]);
    const projectMap = new Map<string, Project>();
    for (const p of projects) projectMap.set(p.id, p);

    const rows: DashboardBindingRow[] = [];
    for (const binding of bindings) {
      const project = projectMap.get(binding.projectId);
      if (project === undefined) continue;
      const classification = classify(binding.key, ruleset.compiled);
      const primaryVendor =
        classification.primary === null
          ? null
          : ruleset.vendors.get(classification.primary.vendorId) ?? null;
      rows.push({ binding, project, classification, primaryVendor });
    }

    return {
      teamId,
      bindings: rows,
      projects,
      vendors: Array.from(ruleset.vendors.values()),
      recentScans,
    };
  }
}
