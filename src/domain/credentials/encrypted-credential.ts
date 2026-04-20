/**
 * Opaque ciphertext envelope holding the user's Vercel API token.
 * The plaintext bearer token never appears in domain entities.
 *
 * Layout is owned by the credentials infrastructure adapter; the
 * domain only knows that "we have an encrypted blob" and a salt for
 * key derivation.
 */
export interface EncryptedCredential {
  readonly version: 1;
  readonly algorithm: "aes-256-gcm";
  readonly kdf: "scrypt";
  readonly salt: Uint8Array;
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly authTag: Uint8Array;
}
