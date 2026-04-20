import type { Vendor } from "../../domain/classification/vendor.js";
import type { VendorRule } from "../../domain/classification/vendor-rule.js";

export interface VendorRuleBundle {
  readonly vendors: readonly Vendor[];
  readonly rules: readonly VendorRule[];
}

export interface VendorRuleSource {
  loadDefault(): Promise<VendorRuleBundle>;
  loadOverride(): Promise<VendorRuleBundle | null>;
  /**
   * Persist a list of unmatched key names + frequencies to a local
   * suggestions file (gitignored). The application uses this as a
   * hint to the operator, not as a source of truth.
   */
  writeSuggestions(unmatched: ReadonlyMap<string, number>): Promise<void>;
}
