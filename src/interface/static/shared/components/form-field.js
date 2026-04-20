import { el } from "../../core/dom.js";

/**
 * Labelled input row.
 *   FormField("Passphrase", { type: "password", id: "pw", value, onInput })
 */
export const FormField = (label, inputAttrs) => {
  const input = el("input", inputAttrs);
  return el("div", { class: "form-row" }, [
    el("label", { class: "form-label", for: inputAttrs.id ?? "" }, label),
    input,
  ]);
};
