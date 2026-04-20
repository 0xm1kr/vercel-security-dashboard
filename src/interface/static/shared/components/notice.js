import { el } from "../../core/dom.js";

/**
 * Coloured banner for inline messages.
 *
 *   Notice({ kind: "error" }, err.message)
 *
 * Kinds: "error", "warn", "success", default (neutral).
 */
export const Notice = (opts, children) =>
  el("div", { class: `notice ${opts.kind ?? ""}`.trim() }, children);
