import { TeamId } from "../../domain/shared/ids.js";
import { validatePassphrase } from "../../infrastructure/credentials/passphrase.js";
import type { CredentialStore } from "../ports/credential-store.js";
import type { VercelPort } from "../ports/vercel-port.js";

export interface MintScopedTokenInput {
  readonly passphrase: string;
  readonly bootstrapToken: string;
  readonly teamId: string | null;
  readonly tokenName: string;
  readonly replaceExisting?: boolean;
}

export interface MintScopedTokenResult {
  readonly tokenName: string;
  readonly storedAt: number;
}

/**
 * Optional onboarding enhancement: mint a new, named auth token
 * scoped to the chosen team using the user's just-verified bootstrap
 * token, then encrypt and store the new token in place of the
 * bootstrap one. The bootstrap token can be revoked from the Vercel
 * dashboard afterwards.
 */
export class MintScopedTokenUseCase {
  constructor(
    private readonly vercel: VercelPort,
    private readonly credentials: CredentialStore,
  ) {}

  async execute(input: MintScopedTokenInput): Promise<MintScopedTokenResult> {
    validatePassphrase(input.passphrase);
    const teamId = input.teamId === null ? null : TeamId(input.teamId);
    const newBearer = await this.vercel.createAuthToken(
      input.bootstrapToken,
      input.tokenName,
      teamId,
    );
    await this.credentials.saveToken(input.passphrase, newBearer, {
      replaceExisting: input.replaceExisting === true,
    });
    return { tokenName: input.tokenName, storedAt: Date.now() };
  }
}
