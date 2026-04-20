import type {
  ClassificationResult,
  VendorMatch,
} from "./classification-result.js";
import type { CompiledVendorRule } from "./vendor-rule.js";

const PATTERN_TYPE_RANK: Record<CompiledVendorRule["patternType"], number> = {
  exact: 3,
  prefix: 2,
  regex: 1,
};

/**
 * Pure classification function: given a key name and a compiled rule
 * set, return all matching vendors sorted by confidence (then by
 * specificity of pattern type).
 *
 * Deterministic and side-effect free; safe to call from anywhere.
 */
export const classify = (
  key: string,
  rules: readonly CompiledVendorRule[],
): ClassificationResult => {
  const matches: VendorMatch[] = [];
  for (const rule of rules) {
    if (rule.matcher(key)) {
      matches.push({
        vendorId: rule.vendorId,
        confidence: rule.confidence,
        patternType: rule.patternType,
        pattern: rule.pattern,
      });
    }
  }
  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return PATTERN_TYPE_RANK[b.patternType] - PATTERN_TYPE_RANK[a.patternType];
  });
  return {
    primary: matches[0] ?? null,
    all: matches,
  };
};
