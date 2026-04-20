import {
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/shared/errors.js";
import type {
  ConnectionProfile,
  CredentialStore,
} from "../../application/ports/credential-store.js";
import { TeamId } from "../../domain/shared/ids.js";
import { decryptToken, encryptToken } from "./crypto.js";
import { validatePassphrase } from "./passphrase.js";
import { writeFileAtomic } from "../system/atomic-write.js";
import type { EncryptedCredential } from "../../domain/credentials/encrypted-credential.js";

interface SerializedCredential {
  readonly version: 1;
  readonly algorithm: "aes-256-gcm";
  readonly kdf: "scrypt";
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly authTag: string;
}

interface SerializedProfile {
  readonly teamId: string;
  readonly teamName: string;
  readonly createdAt: number;
}

const credentialToJson = (cred: EncryptedCredential): SerializedCredential => ({
  version: cred.version,
  algorithm: cred.algorithm,
  kdf: cred.kdf,
  salt: Buffer.from(cred.salt).toString("base64"),
  iv: Buffer.from(cred.iv).toString("base64"),
  ciphertext: Buffer.from(cred.ciphertext).toString("base64"),
  authTag: Buffer.from(cred.authTag).toString("base64"),
});

const credentialFromJson = (raw: unknown): EncryptedCredential => {
  if (raw === null || typeof raw !== "object") {
    throw new ConflictError("Stored credential file is corrupted");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["version"] !== 1) {
    throw new ConflictError(
      `Unsupported credential format version: ${String(obj["version"])}`,
    );
  }
  if (obj["algorithm"] !== "aes-256-gcm" || obj["kdf"] !== "scrypt") {
    throw new ConflictError("Unsupported credential algorithm");
  }
  const decode = (key: string): Buffer => {
    const value = obj[key];
    if (typeof value !== "string") {
      throw new ConflictError(`Credential field "${key}" missing`);
    }
    return Buffer.from(value, "base64");
  };
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    kdf: "scrypt",
    salt: decode("salt"),
    iv: decode("iv"),
    ciphertext: decode("ciphertext"),
    authTag: decode("authTag"),
  };
};

const readJsonFile = <T>(path: string): T | null => {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  if (raw.trim().length === 0) return null;
  return JSON.parse(raw) as T;
};

export class FileCredentialStore implements CredentialStore {
  private readonly credentialPath: string;
  private readonly profilePath: string;

  constructor(dataDir: string) {
    this.credentialPath = join(dataDir, "credentials.json");
    this.profilePath = join(dataDir, "profile.json");
  }

  async hasToken(): Promise<boolean> {
    return existsSync(this.credentialPath);
  }

  async saveToken(
    passphrase: string,
    token: string,
    options: { replaceExisting?: boolean } = {},
  ): Promise<void> {
    validatePassphrase(passphrase);
    if (token.length === 0) {
      throw new ValidationError("Token must not be empty");
    }
    if (existsSync(this.credentialPath) && options.replaceExisting !== true) {
      throw new ConflictError(
        "A Vercel token is already stored. Pass replaceExisting=true to overwrite.",
      );
    }
    const encrypted = encryptToken(passphrase, token);
    writeFileAtomic(
      this.credentialPath,
      JSON.stringify(credentialToJson(encrypted)),
      { mode: 0o600 },
    );
  }

  async unlockToken(passphrase: string): Promise<string> {
    const raw = readJsonFile<SerializedCredential>(this.credentialPath);
    if (raw === null) {
      throw new NotFoundError("No Vercel token has been saved yet");
    }
    const credential = credentialFromJson(raw);
    try {
      return decryptToken(passphrase, credential);
    } catch {
      throw new UnauthorizedError("Incorrect passphrase or corrupted credential file");
    }
  }

  async getProfile(): Promise<ConnectionProfile | null> {
    const raw = readJsonFile<SerializedProfile>(this.profilePath);
    if (raw === null) return null;
    if (typeof raw.teamId !== "string" || typeof raw.teamName !== "string") {
      return null;
    }
    return {
      teamId: TeamId(raw.teamId),
      teamName: raw.teamName,
      createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    };
  }

  async saveProfile(profile: ConnectionProfile): Promise<void> {
    const serialized: SerializedProfile = {
      teamId: profile.teamId,
      teamName: profile.teamName,
      createdAt: profile.createdAt,
    };
    writeFileAtomic(
      this.profilePath,
      JSON.stringify(serialized, null, 2),
      { mode: 0o600 },
    );
  }

  async clear(): Promise<void> {
    for (const p of [this.credentialPath, this.profilePath]) {
      if (existsSync(p)) rmSync(p, { force: true });
    }
  }
}
