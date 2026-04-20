import { el } from "../../core/dom.js";

/**
 * <button> with our standard variants.
 *
 *   Button({ variant: "primary", busy: state.saving, onClick: save },
 *          state.saving ? "Saving…" : "Save")
 *
 * Variants: "primary", "secondary", "danger", default (neutral surface).
 */
export const Button = (opts, label) => {
  const variant = opts.variant ?? "";
  return el(
    "button",
    {
      type: opts.type ?? "button",
      class: `button ${variant}`.trim(),
      disabled: opts.busy === true || opts.disabled === true,
      onClick: opts.onClick,
    },
    label,
  );
};

/** Same as Button but renders busyLabel while busy. */
export const AsyncButton = (opts, label) =>
  Button(opts, opts.busy === true ? (opts.busyLabel ?? label) : label);
