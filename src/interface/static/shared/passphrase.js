/**
 * Mirror of `src/infrastructure/credentials/passphrase.ts` so the UI
 * can give immediate feedback before round-tripping to the server.
 * The server is still authoritative — never trust this for security.
 */
const MIN_LENGTH = 12;
const RECOMMENDED_LENGTH_NO_CLASSES = 16;

const COMMON = new Set([
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

const charClasses = (s) => {
  let mask = 0;
  for (const ch of s) {
    if (/[a-z]/.test(ch)) mask |= 1;
    else if (/[A-Z]/.test(ch)) mask |= 2;
    else if (/[0-9]/.test(ch)) mask |= 4;
    else mask |= 8;
  }
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
};

/** Returns a human-readable failure reason, or null if the passphrase is acceptable. */
export const passphraseStrengthReason = (pw) => {
  if (typeof pw !== "string" || pw.length < MIN_LENGTH) {
    return `Passphrase must be at least ${MIN_LENGTH} characters.`;
  }
  if (COMMON.has(pw.toLowerCase())) return "Passphrase is too common; choose another.";
  if (pw.length < RECOMMENDED_LENGTH_NO_CLASSES && charClasses(pw) < 3) {
    return "Passphrase must use at least three of: lowercase, uppercase, digits, symbols (or be 16+ characters).";
  }
  return null;
};

export const PASSPHRASE_MIN_LENGTH = MIN_LENGTH;
