import {
  asObject,
  optionalBoolean,
  optionalString,
  optionalStringArray,
  readJsonBody,
  requireString,
} from "../validation.js";
import {
  ConflictError,
  ValidationError,
} from "../../../domain/shared/errors.js";
import { parseTargets } from "../../../domain/shared/target.js";
import type { Handler } from "./types.js";

export const rotateBindingHandler: Handler = async ({ req, ctx, params, sessionId }) => {
  const profile = await ctx.credentials.getProfile();
  if (profile === null) {
    throw new ConflictError("Onboarding has not been completed yet");
  }
  const bindingId = params.get("id");
  if (bindingId === undefined || bindingId === null || bindingId.length === 0) {
    throw new ValidationError("binding id is required");
  }
  const body = asObject(await readJsonBody(req));
  const newValueStr = requireString(body, "value");
  // Vercel itself rejects values larger than ~64 KiB; we cap here
  // first to fail fast and avoid sending oversized payloads.
  const MAX_VALUE_BYTES = 64 * 1024;
  if (Buffer.byteLength(newValueStr, "utf8") > MAX_VALUE_BYTES) {
    throw new ValidationError(
      `Field "value" exceeds maximum size of ${MAX_VALUE_BYTES} bytes`,
    );
  }
  const targetsRaw = optionalStringArray(body, "targets");
  const targets = targetsRaw === null ? null : parseTargets(targetsRaw);
  const note = optionalString(body, "note");
  // Default to upgrading the env type to "sensitive" on rotation:
  // anyone bothering to rotate a key is treating it as a secret.
  const markSensitive = optionalBoolean(body, "markSensitive") ?? true;
  const token = ctx.sessions.useToken(sessionId);

  const valueBuffer = Buffer.from(newValueStr, "utf8");
  try {
    const result = await ctx.rotateBinding.execute({
      token,
      teamId: profile.teamId,
      bindingId,
      newValue: valueBuffer,
      targets,
      note,
      markSensitive,
    });
    return {
      type: "json",
      body: {
        ok: true,
        bindingId: result.bindingId,
        rotatedAt: result.rotatedAt,
        status: result.status,
      },
    };
  } finally {
    valueBuffer.fill(0);
  }
};
