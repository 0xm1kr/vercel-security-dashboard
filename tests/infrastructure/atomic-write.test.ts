import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileAtomic } from "../../src/infrastructure/system/atomic-write.ts";

const inTmp = (fn: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "vsd-atomic-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("writeFileAtomic creates a new file at exactly mode 0o600", () => {
  inTmp((dir) => {
    const path = join(dir, "secret.json");
    writeFileAtomic(path, "{\"a\":1}");
    const st = statSync(path);
    // mask off the file-type bits and check the mode bits.
    assert.equal(st.mode & 0o777, 0o600);
    assert.equal(readFileSync(path, "utf8"), "{\"a\":1}");
  });
});

test("writeFileAtomic overwrites existing files atomically", () => {
  inTmp((dir) => {
    const path = join(dir, "data.json");
    writeFileSync(path, "old");
    writeFileAtomic(path, "new", { mode: 0o600 });
    assert.equal(readFileSync(path, "utf8"), "new");
    const st = statSync(path);
    assert.equal(st.mode & 0o777, 0o600);
  });
});

test("writeFileAtomic does not leak its temp file on success", () => {
  inTmp((dir) => {
    const path = join(dir, "x.json");
    writeFileAtomic(path, "v");
    const entries = readdirSync(dir);
    assert.deepEqual(entries.sort(), ["x.json"]);
  });
});
