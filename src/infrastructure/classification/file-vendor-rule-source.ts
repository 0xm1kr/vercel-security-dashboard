import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  VendorRuleBundle,
  VendorRuleSource,
} from "../../application/ports/vendor-rule-source.js";
import type { Vendor } from "../../domain/classification/vendor.js";
import type {
  RulePatternType,
  VendorRule,
} from "../../domain/classification/vendor-rule.js";
import { VendorId } from "../../domain/shared/ids.js";
import { ConflictError } from "../../domain/shared/errors.js";
import { writeFileAtomic } from "../system/atomic-write.js";

interface RawBundle {
  readonly version?: number;
  readonly vendors?: ReadonlyArray<unknown>;
  readonly rules?: ReadonlyArray<unknown>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const PATTERN_TYPES: ReadonlySet<string> = new Set([
  "exact",
  "prefix",
  "regex",
]);

const ALLOWED_URL_SCHEMES: ReadonlySet<string> = new Set(["https:", "http:"]);

/**
 * Sanitise vendor rotation URLs to block `javascript:`, `data:`,
 * `file:` and other dangerous schemes that could be exfiltrated to
 * an attacker-supplied vendor-rules.override.json file.
 */
const isSafeRotateUrl = (raw: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return ALLOWED_URL_SCHEMES.has(parsed.protocol.toLowerCase());
};

/**
 * Reject regexes that look like classic ReDoS patterns. Heuristic:
 * nested quantifiers like `(a+)+`, `(a*)+`, `(a|aa)+`. Not perfect
 * but kills the obvious footguns from copy-pasted patterns.
 */
const REDOS_PATTERN = /(\([^)]*[+*][^)]*\)[+*])|(\([^)]*\|[^)]*\)[+*])/;

const isSafeRegex = (pattern: string): boolean => {
  if (pattern.length > 256) return false;
  if (REDOS_PATTERN.test(pattern)) return false;
  try {
    new RegExp(pattern);
  } catch {
    return false;
  }
  return true;
};

const parseBundle = (raw: unknown, sourceLabel: string): VendorRuleBundle => {
  if (!isObject(raw)) {
    throw new ConflictError(`${sourceLabel}: top-level value must be an object`);
  }
  const bundle = raw as RawBundle;
  const vendors: Vendor[] = [];
  if (Array.isArray(bundle.vendors)) {
    for (const v of bundle.vendors) {
      if (!isObject(v)) continue;
      const id = typeof v["id"] === "string" ? v["id"] : null;
      const name = typeof v["displayName"] === "string" ? v["displayName"] : null;
      const url = typeof v["rotateUrl"] === "string" ? v["rotateUrl"] : null;
      if (id === null || name === null || url === null) continue;
      if (!isSafeRotateUrl(url)) {
        throw new ConflictError(
          `${sourceLabel}: vendor "${id}" has unsafe rotateUrl scheme; only http(s) is allowed`,
        );
      }
      vendors.push({ id: VendorId(id), displayName: name, rotateUrl: url });
    }
  }
  const rules: VendorRule[] = [];
  if (Array.isArray(bundle.rules)) {
    for (const r of bundle.rules) {
      if (!isObject(r)) continue;
      const vendorId = typeof r["vendorId"] === "string" ? r["vendorId"] : null;
      const patternType =
        typeof r["patternType"] === "string" ? r["patternType"] : null;
      const pattern = typeof r["pattern"] === "string" ? r["pattern"] : null;
      const confidence =
        typeof r["confidence"] === "number" ? r["confidence"] : 50;
      if (
        vendorId === null ||
        patternType === null ||
        pattern === null ||
        !PATTERN_TYPES.has(patternType)
      )
        continue;
      if (patternType === "regex" && !isSafeRegex(pattern)) {
        throw new ConflictError(
          `${sourceLabel}: rule for "${vendorId}" has an unsafe or invalid regex`,
        );
      }
      rules.push({
        vendorId: VendorId(vendorId),
        patternType: patternType as RulePatternType,
        pattern,
        confidence,
      });
    }
  }
  return { vendors, rules };
};

export class FileVendorRuleSource implements VendorRuleSource {
  constructor(
    private readonly defaultPath: string,
    private readonly overridePath: string,
    private readonly suggestionsPath: string,
  ) {}

  async loadDefault(): Promise<VendorRuleBundle> {
    if (!existsSync(this.defaultPath)) {
      return { vendors: [], rules: [] };
    }
    const raw = JSON.parse(readFileSync(this.defaultPath, "utf8")) as unknown;
    return parseBundle(raw, this.defaultPath);
  }

  async loadOverride(): Promise<VendorRuleBundle | null> {
    if (!existsSync(this.overridePath)) return null;
    const raw = JSON.parse(readFileSync(this.overridePath, "utf8")) as unknown;
    return parseBundle(raw, this.overridePath);
  }

  async writeSuggestions(unmatched: ReadonlyMap<string, number>): Promise<void> {
    const entries = Array.from(unmatched.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));
    const payload = {
      generatedAt: new Date().toISOString(),
      note: "Unmatched env keys observed during scan. Copy interesting entries into vendor-rules.override.json.",
      unmatched: entries,
    };
    writeFileAtomic(
      this.suggestionsPath,
      JSON.stringify(payload, null, 2),
      { mode: 0o600 },
    );
  }

  static defaultPaths(repoRoot: string, dataDir: string): {
    defaultPath: string;
    overridePath: string;
    suggestionsPath: string;
  } {
    return {
      defaultPath: join(repoRoot, "config", "vendor-rules.default.json"),
      overridePath: join(dataDir, "vendor-rules.override.json"),
      suggestionsPath: join(dataDir, "vendor-rules.suggested.json"),
    };
  }
}
