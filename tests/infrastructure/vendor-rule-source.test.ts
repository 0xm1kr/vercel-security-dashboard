import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileVendorRuleSource } from "../../src/infrastructure/classification/file-vendor-rule-source.ts";
import { ConflictError } from "../../src/domain/shared/errors.ts";

const inTmp = async (
  fn: (dir: string, paths: { def: string; ovr: string; sug: string }) => Promise<void>,
): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "vsd-rules-"));
  try {
    await fn(dir, {
      def: join(dir, "default.json"),
      ovr: join(dir, "override.json"),
      sug: join(dir, "suggested.json"),
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("FileVendorRuleSource rejects javascript: rotateUrl scheme", async () => {
  await inTmp(async (_dir, paths) => {
    writeFileSync(
      paths.def,
      JSON.stringify({
        version: 1,
        vendors: [
          { id: "evil", displayName: "Evil", rotateUrl: "javascript:alert(1)" },
        ],
        rules: [],
      }),
    );
    const src = new FileVendorRuleSource(paths.def, paths.ovr, paths.sug);
    await assert.rejects(() => src.loadDefault(), ConflictError);
  });
});

test("FileVendorRuleSource rejects file: rotateUrl scheme", async () => {
  await inTmp(async (_dir, paths) => {
    writeFileSync(
      paths.def,
      JSON.stringify({
        version: 1,
        vendors: [
          { id: "evil", displayName: "Evil", rotateUrl: "file:///etc/passwd" },
        ],
        rules: [],
      }),
    );
    const src = new FileVendorRuleSource(paths.def, paths.ovr, paths.sug);
    await assert.rejects(() => src.loadDefault(), ConflictError);
  });
});

test("FileVendorRuleSource accepts http(s) rotateUrl schemes", async () => {
  await inTmp(async (_dir, paths) => {
    writeFileSync(
      paths.def,
      JSON.stringify({
        version: 1,
        vendors: [
          { id: "ok", displayName: "OK", rotateUrl: "https://example.com/rotate" },
        ],
        rules: [{ vendorId: "ok", patternType: "prefix", pattern: "OK_", confidence: 80 }],
      }),
    );
    const src = new FileVendorRuleSource(paths.def, paths.ovr, paths.sug);
    const bundle = await src.loadDefault();
    assert.equal(bundle.vendors.length, 1);
    assert.equal(bundle.rules.length, 1);
  });
});

test("FileVendorRuleSource rejects obvious ReDoS regex", async () => {
  await inTmp(async (_dir, paths) => {
    writeFileSync(
      paths.def,
      JSON.stringify({
        version: 1,
        vendors: [
          { id: "ok", displayName: "OK", rotateUrl: "https://example.com" },
        ],
        rules: [
          { vendorId: "ok", patternType: "regex", pattern: "^(a+)+$", confidence: 50 },
        ],
      }),
    );
    const src = new FileVendorRuleSource(paths.def, paths.ovr, paths.sug);
    await assert.rejects(() => src.loadDefault(), ConflictError);
  });
});
