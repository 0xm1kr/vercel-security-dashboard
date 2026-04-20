import { ValidationError } from "../shared/errors.js";
import type { VendorId } from "../shared/ids.js";

export type RulePatternType = "exact" | "prefix" | "regex";

export interface VendorRule {
  readonly vendorId: VendorId;
  readonly patternType: RulePatternType;
  readonly pattern: string;
  /** 0–100. Exact > prefix > regex by convention, but configurable. */
  readonly confidence: number;
}

export interface CompiledVendorRule extends VendorRule {
  readonly matcher: (key: string) => boolean;
}

const PATTERN_TYPES: ReadonlySet<string> = new Set([
  "exact",
  "prefix",
  "regex",
]);

const buildMatcher = (rule: VendorRule): ((key: string) => boolean) => {
  switch (rule.patternType) {
    case "exact": {
      const target = rule.pattern;
      return (key: string) => key === target;
    }
    case "prefix": {
      const target = rule.pattern;
      return (key: string) => key.startsWith(target);
    }
    case "regex": {
      const re = new RegExp(rule.pattern);
      return (key: string) => re.test(key);
    }
    default: {
      const _exhaustive: never = rule.patternType;
      return () => _exhaustive;
    }
  }
};

export const compileRule = (rule: VendorRule): CompiledVendorRule => {
  if (!PATTERN_TYPES.has(rule.patternType)) {
    throw new ValidationError(
      `Unknown vendor rule patternType: ${String(rule.patternType)}`,
    );
  }
  if (rule.pattern.length === 0) {
    throw new ValidationError("Vendor rule pattern must not be empty");
  }
  if (rule.confidence < 0 || rule.confidence > 100) {
    throw new ValidationError("Vendor rule confidence must be between 0 and 100");
  }
  return { ...rule, matcher: buildMatcher(rule) };
};
