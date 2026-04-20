import type { CredentialStore } from "../ports/credential-store.js";
import type { VercelPort } from "../ports/vercel-port.js";
import { TeamId } from "../../domain/shared/ids.js";
import { ValidationError } from "../../domain/shared/errors.js";
import { validatePassphrase } from "../../infrastructure/credentials/passphrase.js";
import type { Clock } from "../ports/clock.js";

export interface SaveOnboardingInput {
  readonly passphrase: string;
  readonly token: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly replaceExisting?: boolean;
}

/**
 * Final step of the onboarding wizard: re-verify the token, list
 * teams to confirm the chosen team is reachable, and persist the
 * encrypted token + connection profile.
 */
export class SaveOnboardingUseCase {
  constructor(
    private readonly credentials: CredentialStore,
    private readonly vercel: VercelPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: SaveOnboardingInput): Promise<void> {
    validatePassphrase(input.passphrase);
    if (input.token.length === 0) {
      throw new ValidationError("Token must not be empty");
    }
    const teamId = TeamId(input.teamId);

    // Re-verify by listing teams; ensures the chosen team is real and
    // reachable before we persist a profile pointing to it.
    const teams = await this.vercel.listTeams(input.token);
    const match = teams.find((t) => t.id === teamId);
    if (match === undefined) {
      throw new ValidationError(
        "Selected team is not visible to this token",
      );
    }

    await this.credentials.saveToken(input.passphrase, input.token, {
      replaceExisting: input.replaceExisting === true,
    });
    await this.credentials.saveProfile({
      teamId,
      teamName: input.teamName.length > 0 ? input.teamName : match.name,
      createdAt: this.clock.now(),
    });
  }
}
