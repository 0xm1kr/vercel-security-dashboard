import test from "node:test";
import assert from "node:assert/strict";
import { checkOrigin } from "../../src/interface/http/origin-guard.ts";

const opts = { host: "127.0.0.1", port: 4319 } as const;

test("safe GET to 127.0.0.1 is allowed without an Origin header", () => {
  const r = checkOrigin("GET", "127.0.0.1:4319", undefined, opts);
  assert.equal(r.ok, true);
});

test("safe GET to localhost is allowed", () => {
  const r = checkOrigin("GET", "localhost:4319", undefined, opts);
  assert.equal(r.ok, true);
});

test("GET with attacker Host (DNS rebinding) is rejected with 421", () => {
  const r = checkOrigin("GET", "evil.example.com", undefined, opts);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 421);
});

test("POST without Origin header is rejected", () => {
  const r = checkOrigin("POST", "127.0.0.1:4319", undefined, opts);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 403);
});

test("POST with cross-origin Origin is rejected", () => {
  const r = checkOrigin(
    "POST",
    "127.0.0.1:4319",
    "https://evil.example.com",
    opts,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 403);
});

test("POST with same-origin localhost Origin is allowed", () => {
  const r = checkOrigin(
    "POST",
    "127.0.0.1:4319",
    "http://127.0.0.1:4319",
    opts,
  );
  assert.equal(r.ok, true);
});

test("Origin port mismatch is rejected", () => {
  const r = checkOrigin(
    "POST",
    "127.0.0.1:4319",
    "http://127.0.0.1:9999",
    opts,
  );
  assert.equal(r.ok, false);
});

test("non-loopback bind skips Host allow-list", () => {
  const r = checkOrigin(
    "GET",
    "192.168.1.10:4319",
    undefined,
    { host: "0.0.0.0", port: 4319 },
  );
  assert.equal(r.ok, true);
});
