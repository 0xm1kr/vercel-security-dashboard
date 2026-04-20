import type { DashboardData, DashboardBindingRow } from "../../../application/inventory/get-dashboard-data.js";
import type { Project } from "../../../domain/inventory/project.js";
import type { Scan } from "../../../domain/inventory/scan.js";
import type { Vendor } from "../../../domain/classification/vendor.js";
import type { EnvBinding } from "../../../domain/inventory/env-binding.js";
import type { ClassificationResult } from "../../../domain/classification/classification-result.js";

export interface BindingDto {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly key: string;
  readonly targets: readonly string[];
  readonly gitBranch: string | null;
  readonly type: string;
  readonly remoteCreatedAt: number | null;
  readonly remoteUpdatedAt: number | null;
  readonly rotationStatus: string;
  readonly rotatedAt: number | null;
  readonly vendor: VendorDto | null;
  readonly classifications: readonly VendorMatchDto[];
}

export interface VendorDto {
  readonly id: string;
  readonly displayName: string;
  readonly rotateUrl: string;
}

export interface VendorMatchDto {
  readonly vendorId: string;
  readonly confidence: number;
  readonly patternType: string;
  readonly pattern: string;
}

export interface ProjectDto {
  readonly id: string;
  readonly name: string;
  readonly framework: string | null;
}

export interface ScanDto {
  readonly id: string;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly status: string;
  readonly projectsScanned: number;
  readonly bindingsSeen: number;
  readonly errorMessage: string | null;
}

export interface DashboardDto {
  readonly teamId: string;
  readonly bindings: readonly BindingDto[];
  readonly projects: readonly ProjectDto[];
  readonly vendors: readonly VendorDto[];
  readonly recentScans: readonly ScanDto[];
}

const toVendorDto = (v: Vendor): VendorDto => ({
  id: v.id,
  displayName: v.displayName,
  rotateUrl: v.rotateUrl,
});

const toProjectDto = (p: Project): ProjectDto => ({
  id: p.id,
  name: p.name,
  framework: p.framework,
});

const toScanDto = (s: Scan): ScanDto => ({
  id: s.id,
  startedAt: s.startedAt,
  finishedAt: s.finishedAt,
  status: s.status,
  projectsScanned: s.projectsScanned,
  bindingsSeen: s.bindingsSeen,
  errorMessage: s.errorMessage,
});

const toBindingDto = (
  binding: EnvBinding,
  project: Project,
  classification: ClassificationResult,
  vendor: Vendor | null,
): BindingDto => ({
  id: binding.id,
  projectId: project.id,
  projectName: project.name,
  key: binding.key,
  targets: [...binding.targets],
  gitBranch: binding.gitBranch,
  type: binding.type,
  remoteCreatedAt: binding.remoteCreatedAt,
  remoteUpdatedAt: binding.remoteUpdatedAt,
  rotationStatus: binding.rotationStatus,
  rotatedAt: binding.rotatedAt,
  vendor: vendor === null ? null : toVendorDto(vendor),
  classifications: classification.all.map((m) => ({
    vendorId: m.vendorId,
    confidence: m.confidence,
    patternType: m.patternType,
    pattern: m.pattern,
  })),
});

export const toDashboardDto = (data: DashboardData): DashboardDto => ({
  teamId: data.teamId,
  bindings: data.bindings.map((row: DashboardBindingRow) =>
    toBindingDto(row.binding, row.project, row.classification, row.primaryVendor),
  ),
  projects: data.projects.map(toProjectDto),
  vendors: data.vendors.map(toVendorDto),
  recentScans: data.recentScans.map(toScanDto),
});
