import type { VendorId } from "../shared/ids.js";

export interface VendorMatch {
  readonly vendorId: VendorId;
  readonly confidence: number;
  readonly patternType: "exact" | "prefix" | "regex";
  readonly pattern: string;
}

export interface ClassificationResult {
  /** Best (highest confidence) match, if any. */
  readonly primary: VendorMatch | null;
  /** All matches, sorted by confidence descending. */
  readonly all: readonly VendorMatch[];
}
