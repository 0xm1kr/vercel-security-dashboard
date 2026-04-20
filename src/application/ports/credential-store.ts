import type { TeamId } from "../../domain/shared/ids.js";

/**
 * Stored connection profile: which team the user selected and a
 * display name for it. The Vercel bearer token itself is held by
 * `CredentialStore` (encrypted), not in this profile.
 */
export interface ConnectionProfile {
  readonly teamId: TeamId;
  readonly teamName: string;
  readonly createdAt: number;
}

/**
 * Stores the Vercel API token encrypted at rest and the active
 * connection profile. Implementations must never persist the bearer
 * token in plaintext.
 */
export interface CredentialStore {
  /**
   * @returns true if a token has been saved (regardless of whether
   *   the unlock passphrase is currently held in memory).
   */
  hasToken(): Promise<boolean>;

  /**
   * Encrypts and stores the bearer token using the given passphrase.
   * Refuses to overwrite an existing token unless `replaceExisting`
   * is explicitly true.
   */
  saveToken(
    passphrase: string,
    token: string,
    options?: { replaceExisting?: boolean },
  ): Promise<void>;

  /**
   * Decrypts and returns the bearer token. Throws if no token is
   * stored or if the passphrase is incorrect.
   */
  unlockToken(passphrase: string): Promise<string>;

  getProfile(): Promise<ConnectionProfile | null>;
  saveProfile(profile: ConnectionProfile): Promise<void>;
  clear(): Promise<void>;
}
