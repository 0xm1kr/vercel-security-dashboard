import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileCredentialStore } from "../../src/infrastructure/credentials/file-credential-store.ts";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "../../src/domain/shared/errors.ts";

const inTmp = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "vsd-creds-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("FileCredentialStore refuses to overwrite an existing token without the flag", async () => {
  await inTmp(async (dir) => {
    const store = new FileCredentialStore(dir);
    await store.saveToken("Aa1!Aa1!Aa1!", "tok-1");
    await assert.rejects(
      () => store.saveToken("Aa1!Aa1!Aa1!", "tok-2"),
      ConflictError,
    );
  });
});

test("FileCredentialStore overwrites when replaceExisting=true", async () => {
  await inTmp(async (dir) => {
    const store = new FileCredentialStore(dir);
    await store.saveToken("Aa1!Aa1!Aa1!", "tok-1");
    await store.saveToken("Aa1!Aa1!Aa1!", "tok-2", { replaceExisting: true });
    const back = await store.unlockToken("Aa1!Aa1!Aa1!");
    assert.equal(back, "tok-2");
  });
});

test("FileCredentialStore writes credentials.json at mode 0o600", async () => {
  await inTmp(async (dir) => {
    const store = new FileCredentialStore(dir);
    await store.saveToken("Aa1!Aa1!Aa1!", "vercel_pat_abc");
    const st = statSync(join(dir, "credentials.json"));
    assert.equal(st.mode & 0o777, 0o600);
  });
});

test("FileCredentialStore.saveToken rejects weak passphrases", async () => {
  await inTmp(async (dir) => {
    const store = new FileCredentialStore(dir);
    await assert.rejects(
      () => store.saveToken("short", "tok"),
      ValidationError,
    );
  });
});

test("FileCredentialStore.unlockToken throws on bad passphrase", async () => {
  await inTmp(async (dir) => {
    const store = new FileCredentialStore(dir);
    await store.saveToken("Aa1!Aa1!Aa1!", "tok-x");
    await assert.rejects(
      () => store.unlockToken("Bb2@Bb2@Bb2@"),
      UnauthorizedError,
    );
  });
});
