import type { Handler } from "./types.js";

export const healthHandler: Handler = async () => ({
  type: "json",
  body: { ok: true },
});
