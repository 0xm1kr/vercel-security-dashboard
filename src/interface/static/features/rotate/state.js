/**
 * Per-rotation form state. Cleared (best-effort) after submit / close
 * so we don't keep the new secret in JS strings any longer than needed.
 *
 * Note: JS strings are immutable; we cannot truly zero memory. The
 * security model accepts this in exchange for not having a Buffer-only
 * UI runtime. The value is also held briefly in the <input> element
 * which we always reset on close.
 */
export const rotateState = {
  binding: null,
  value: "",
  note: "",
  markSensitive: true,
  busy: false,
  error: null,
};

export const resetRotate = () => {
  rotateState.binding = null;
  rotateState.value = "";
  rotateState.note = "";
  rotateState.markSensitive = true;
  rotateState.busy = false;
  rotateState.error = null;
};
