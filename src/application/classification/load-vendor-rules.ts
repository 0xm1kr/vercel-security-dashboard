import {
  compileRule,
  type CompiledVendorRule,
} from "../../domain/classification/vendor-rule.js";
import type { Vendor } from "../../domain/classification/vendor.js";
import type { VendorRuleSource } from "../ports/vendor-rule-source.js";

export interface LoadedVendorRules {
  readonly vendors: ReadonlyMap<string, Vendor>;
  readonly compiled: readonly CompiledVendorRule[];
}

/**
 * Loads default + override rules from the source and compiles them
 * into a single ruleset. Override rules are appended after defaults
 * so a higher-confidence override naturally wins via the classifier's
 * sort order. Override vendors with the same id replace defaults.
 */
export class LoadVendorRulesUseCase {
  constructor(private readonly source: VendorRuleSource) {}

  async execute(): Promise<LoadedVendorRules> {
    const defaults = await this.source.loadDefault();
    const override = await this.source.loadOverride();

    const vendorMap = new Map<string, Vendor>();
    for (const v of defaults.vendors) vendorMap.set(v.id, v);
    if (override !== null) {
      for (const v of override.vendors) vendorMap.set(v.id, v);
    }

    const allRules = override === null
      ? defaults.rules
      : [...defaults.rules, ...override.rules];

    const compiled = allRules.map(compileRule);
    return { vendors: vendorMap, compiled };
  }
}
