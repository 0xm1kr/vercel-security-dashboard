import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTargets,
  targetsEqual,
} from "../../src/domain/shared/target.ts";

test("parseTargets canonicalizes order and de-duplicates", () => {
  const targets = parseTargets(["preview", "production", "preview"]);
  assert.deepEqual(targets, ["production", "preview"]);
});

test("parseTargets rejects invalid values", () => {
  assert.throws(() => parseTargets(["nope"]));
});

test("targetsEqual is order-sensitive after canonicalisation", () => {
  const a = parseTargets(["development", "production"]);
  const b = parseTargets(["production", "development"]);
  assert.equal(targetsEqual(a, b), true);
});
