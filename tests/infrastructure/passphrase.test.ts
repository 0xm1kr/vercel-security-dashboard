import test from "node:test";
import assert from "node:assert/strict";
import { validatePassphrase } from "../../src/infrastructure/credentials/passphrase.ts";
import { ValidationError } from "../../src/domain/shared/errors.ts";

test("validatePassphrase rejects short passphrases", () => {
  assert.throws(() => validatePassphrase("Aa1!Aa1!"), ValidationError);
});

test("validatePassphrase rejects common weak passphrases", () => {
  assert.throws(() => validatePassphrase("PASSWORD1234"), ValidationError);
});

test("validatePassphrase rejects 12-char single-class passphrases", () => {
  assert.throws(() => validatePassphrase("aaaaaaaaaaaa"), ValidationError);
  assert.throws(() => validatePassphrase("ABCDEFGHIJKL"), ValidationError);
  assert.throws(() => validatePassphrase("123456789012"), ValidationError);
});

test("validatePassphrase accepts 12-char passphrase with 3+ classes", () => {
  assert.doesNotThrow(() => validatePassphrase("Aa1!Aa1!Aa1!"));
  assert.doesNotThrow(() => validatePassphrase("Hunter22Cool"));
});

test("validatePassphrase accepts long single-class passphrases (>=16)", () => {
  assert.doesNotThrow(() => validatePassphrase("aaaaaaaaaaaaaaaa"));
  assert.doesNotThrow(() => validatePassphrase("correct horse battery staple"));
});
