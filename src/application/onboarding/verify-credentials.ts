import { Err, Ok, type Result } from "../../domain/shared/result.js";
import { UnauthorizedError } from "../../domain/shared/errors.js";
import type { VercelPort, VercelUser } from "../ports/vercel-port.js";

export interface VerifyCredentialsFailure {
  readonly reason: "unauthorized" | "network" | "unexpected";
  readonly message: string;
}

/**
 * Calls a minimal Vercel REST endpoint with the supplied bearer
 * token to confirm it works before we encrypt and persist it.
 */
export class VerifyCredentialsUseCase {
  constructor(private readonly vercel: VercelPort) {}

  async execute(
    token: string,
  ): Promise<Result<VercelUser, VerifyCredentialsFailure>> {
    try {
      const user = await this.vercel.getCurrentUser(token);
      return Ok(user);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return Err({
          reason: "unauthorized",
          message: "Token is invalid or lacks permission to read your user.",
        });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return Err({ reason: "unexpected", message });
    }
  }
}
