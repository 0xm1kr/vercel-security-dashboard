import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../../src/domain/classification/classifier.ts";
import { compileRule } from "../../src/domain/classification/vendor-rule.ts";
import { VendorId } from "../../src/domain/shared/ids.ts";

const ruleSet = [
  compileRule({
    vendorId: VendorId("aws"),
    patternType: "prefix",
    pattern: "AWS_",
    confidence: 90,
  }),
  compileRule({
    vendorId: VendorId("aws"),
    patternType: "exact",
    pattern: "AWS_SECRET_ACCESS_KEY",
    confidence: 95,
  }),
  compileRule({
    vendorId: VendorId("stripe"),
    patternType: "prefix",
    pattern: "STRIPE_",
    confidence: 95,
  }),
  compileRule({
    vendorId: VendorId("custom"),
    patternType: "regex",
    pattern: "^MY_",
    confidence: 50,
  }),
];

test("classify returns null primary when no rules match", () => {
  const result = classify("RANDOM_KEY", ruleSet);
  assert.equal(result.primary, null);
  assert.equal(result.all.length, 0);
});

test("classify picks the highest confidence match", () => {
  const result = classify("AWS_SECRET_ACCESS_KEY", ruleSet);
  assert.notEqual(result.primary, null);
  assert.equal(result.primary?.confidence, 95);
  assert.equal(result.primary?.patternType, "exact");
});

test("classify returns all matches sorted by confidence then specificity", () => {
  const result = classify("AWS_REGION", ruleSet);
  assert.equal(result.all.length, 1);
  assert.equal(result.all[0]?.vendorId, "aws");
});

test("classify handles regex matches", () => {
  const result = classify("MY_THING", ruleSet);
  assert.equal(result.primary?.vendorId, "custom");
  assert.equal(result.primary?.patternType, "regex");
});
