import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptToken,
  encryptToken,
} from "../../src/infrastructure/credentials/crypto.ts";

test("encryptToken / decryptToken round-trips for the same passphrase", () => {
  const cred = encryptToken("correct horse battery staple", "vercel_secret_value");
  const back = decryptToken("correct horse battery staple", cred);
  assert.equal(back, "vercel_secret_value");
});

test("decryptToken throws for an incorrect passphrase", () => {
  const cred = encryptToken("good-passphrase-x9!", "abc");
  assert.throws(() => decryptToken("wrong-passphrase-x9!", cred));
});

test("encryptToken produces a unique IV and salt per call", () => {
  const a = encryptToken("Aa1!Aa1!Aa1!", "same-value");
  const b = encryptToken("Aa1!Aa1!Aa1!", "same-value");
  assert.notEqual(Buffer.from(a.iv).toString("base64"), Buffer.from(b.iv).toString("base64"));
  assert.notEqual(Buffer.from(a.salt).toString("base64"), Buffer.from(b.salt).toString("base64"));
  assert.notEqual(
    Buffer.from(a.ciphertext).toString("base64"),
    Buffer.from(b.ciphertext).toString("base64"),
  );
});
