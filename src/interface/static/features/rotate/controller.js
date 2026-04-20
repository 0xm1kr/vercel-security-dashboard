import { api } from "../../core/api.js";
import { render } from "../../core/scheduler.js";
import { invalidateDashboard } from "../dashboard/state.js";
import { resetRotate, rotateState } from "./state.js";
import { buildDialog, renderDialogBody } from "./view.js";

let dialog = null;

const ensureDialog = () => {
  if (dialog !== null) return dialog;
  dialog = buildDialog({
    onClose: closeRotateDialog,
    onSubmit: () => {
      // Real submit handling is set per-open in renderDialogBody. This
      // listener is a safety net so accidental form submits don't
      // navigate away.
    },
  });
  document.body.append(dialog);
  return dialog;
};

const submit = async ({ value, targets }) => {
  if (rotateState.binding === null) return;
  if (value.length === 0) {
    rotateState.error = "New value is required.";
    refreshBody();
    return;
  }
  rotateState.busy = true;
  rotateState.error = null;
  refreshBody();
  try {
    await api(
      "POST",
      `/api/bindings/${encodeURIComponent(rotateState.binding.id)}/rotate`,
      {
        value,
        targets: targets.length > 0 ? targets : null,
        note: rotateState.note === "" ? null : rotateState.note,
        markSensitive: rotateState.markSensitive,
      },
    );
    closeRotateDialog();
    invalidateDashboard();
    render();
  } catch (err) {
    rotateState.busy = false;
    rotateState.error = err.message;
    refreshBody();
  }
};

const refreshBody = () => {
  if (dialog === null) return;
  renderDialogBody({
    dialog,
    onClose: closeRotateDialog,
    onSubmitValue: submit,
  });
};

export const openRotateDialog = (binding) => {
  resetRotate();
  rotateState.binding = binding;
  const d = ensureDialog();
  refreshBody();
  d.showModal();
};

export const closeRotateDialog = () => {
  if (dialog !== null && dialog.open) dialog.close();
  resetRotate();
};
