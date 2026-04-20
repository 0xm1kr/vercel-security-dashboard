import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import type { EncryptedCredential } from "../../domain/credentials/encrypted-credential.js";

const KEY_LEN = 32; // 256-bit
const IV_LEN = 12; // 96-bit IV recommended for GCM
const SALT_LEN = 16;
// OWASP 2024 baseline for interactive use: N >= 2^17, r = 8, p = 1.
// 128 * N * r ~= 134 MiB working set, so maxmem must be larger.
const SCRYPT_COST = 1 << 17; // N = 131072
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLEL = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

const deriveKey = (passphrase: string, salt: Uint8Array): Buffer =>
  scryptSync(
    passphrase.normalize("NFKC"),
    Buffer.from(salt),
    KEY_LEN,
    {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLEL,
      maxmem: SCRYPT_MAXMEM,
    },
  );

export const encryptToken = (
  passphrase: string,
  plaintext: string,
): EncryptedCredential => {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      version: 1,
      algorithm: "aes-256-gcm",
      kdf: "scrypt",
      salt,
      iv,
      ciphertext,
      authTag,
    };
  } finally {
    key.fill(0);
  }
};

export const decryptToken = (
  passphrase: string,
  credential: EncryptedCredential,
): string => {
  const key = deriveKey(passphrase, credential.salt);
  try {
    const decipher = createDecipheriv(
      credential.algorithm,
      key,
      Buffer.from(credential.iv),
    );
    decipher.setAuthTag(Buffer.from(credential.authTag));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(credential.ciphertext)),
      decipher.final(),
    ]);
    try {
      return plaintext.toString("utf8");
    } finally {
      plaintext.fill(0);
    }
  } finally {
    key.fill(0);
  }
};
