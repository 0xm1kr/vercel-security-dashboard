import { ValidationError } from "../../domain/shared/errors.js";

const MIN_LENGTH = 12;
const RECOMMENDED_LENGTH_NO_CLASSES = 16;

const COMMON_WEAK: ReadonlySet<string> = new Set([
  "password",
  "password1",
  "passw0rd",
  "letmein",
  "qwerty",
  "qwerty123",
  "iloveyou",
  "admin",
  "welcome",
  "abc123",
  "123456",
  "12345678",
  "111111",
  "monkey",
  "dragon",
  "trustno1",
]);

const charClasses = (s: string): number => {
  let mask = 0;
  for (const ch of s) {
    if (/[a-z]/.test(ch)) mask |= 1;
    else if (/[A-Z]/.test(ch)) mask |= 2;
    else if (/[0-9]/.test(ch)) mask |= 4;
    else mask |= 8;
  }
  return (
    (mask & 1) +
    ((mask >> 1) & 1) +
    ((mask >> 2) & 1) +
    ((mask >> 3) & 1)
  );
};

/**
 * Reject obviously-weak passphrases. Not a substitute for a real
 * password manager; the goal is to make brute-forcing the local
 * scrypt key prohibitively slow for any sensible attacker.
 *
 * Rules:
 *  - At least 12 characters.
 *  - Either >= 16 characters (any classes), OR uses 3+ character
 *    classes (lower / upper / digit / symbol).
 *  - Not in a small built-in common-weak list.
 */
export const validatePassphrase = (passphrase: string): void => {
  if (typeof passphrase !== "string" || passphrase.length < MIN_LENGTH) {
    throw new ValidationError(
      `Passphrase must be at least ${MIN_LENGTH} characters`,
    );
  }
  const lower = passphrase.toLowerCase();
  if (COMMON_WEAK.has(lower)) {
    throw new ValidationError("Passphrase is too common; choose another");
  }
  const classes = charClasses(passphrase);
  if (passphrase.length < RECOMMENDED_LENGTH_NO_CLASSES && classes < 3) {
    throw new ValidationError(
      "Passphrase must use at least three of: lowercase, uppercase, digits, symbols (or be 16+ characters)",
    );
  }
};

export const PASSPHRASE_MIN_LENGTH = MIN_LENGTH;
