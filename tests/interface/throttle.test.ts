import test from "node:test";
import assert from "node:assert/strict";
import { LoginThrottle } from "../../src/interface/http/throttle.ts";
import { UnauthorizedError } from "../../src/domain/shared/errors.ts";

test("LoginThrottle allows the first three failures with no lockout", () => {
  let now = 0;
  const t = new LoginThrottle(() => now);
  for (let i = 0; i < 3; i++) {
    t.ensureAllowed("k");
    t.recordFailure("k");
    now += 100;
  }
  assert.doesNotThrow(() => t.ensureAllowed("k"));
});

test("LoginThrottle locks out on the 4th failure with a 2s cooldown", () => {
  let now = 0;
  const t = new LoginThrottle(() => now);
  for (let i = 0; i < 4; i++) {
    t.recordFailure("k");
  }
  assert.throws(() => t.ensureAllowed("k"), UnauthorizedError);
  now += 1999;
  assert.throws(() => t.ensureAllowed("k"));
  now += 2;
  assert.doesNotThrow(() => t.ensureAllowed("k"));
});

test("LoginThrottle backoff escalates: 2s, 4s, 8s, ...", () => {
  let now = 0;
  const t = new LoginThrottle(() => now);
  for (let i = 0; i < 4; i++) t.recordFailure("k"); // -> 2s lockout
  now += 2000;
  assert.doesNotThrow(() => t.ensureAllowed("k"));
  t.recordFailure("k"); // 5th failure -> 4s lockout
  assert.throws(() => t.ensureAllowed("k"));
  now += 3999;
  assert.throws(() => t.ensureAllowed("k"));
  now += 2;
  assert.doesNotThrow(() => t.ensureAllowed("k"));
  t.recordFailure("k"); // 6th failure -> 8s lockout
  now += 7999;
  assert.throws(() => t.ensureAllowed("k"));
  now += 2;
  assert.doesNotThrow(() => t.ensureAllowed("k"));
});

test("LoginThrottle.recordSuccess clears the bucket", () => {
  let now = 0;
  const t = new LoginThrottle(() => now);
  for (let i = 0; i < 5; i++) t.recordFailure("k");
  t.recordSuccess("k");
  assert.doesNotThrow(() => t.ensureAllowed("k"));
});

test("LoginThrottle isolates buckets by key", () => {
  const t = new LoginThrottle();
  for (let i = 0; i < 5; i++) t.recordFailure("ip-a");
  assert.throws(() => t.ensureAllowed("ip-a"));
  assert.doesNotThrow(() => t.ensureAllowed("ip-b"));
});

test("LoginThrottle forgives failures older than the window", () => {
  let now = 0;
  const t = new LoginThrottle(() => now);
  for (let i = 0; i < 4; i++) t.recordFailure("k");
  assert.throws(() => t.ensureAllowed("k"));
  now += 6 * 60 * 1000; // > FAILURE_WINDOW_MS
  assert.doesNotThrow(() => t.ensureAllowed("k"));
});
