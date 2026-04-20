import { api } from "../../core/api.js";
import { navigate } from "../../core/hash.js";
import { render } from "../../core/scheduler.js";
import { clearWizard } from "../onboarding/state.js";
import { refreshProfile } from "../profile/state.js";
import { clearUnlock, unlockState } from "./state.js";

export const submitUnlock = async () => {
  unlockState.busy = true;
  unlockState.error = null;
  render();
  try {
    await api("POST", "/api/session/unlock", {
      passphrase: unlockState.passphrase,
    });
    clearUnlock();
    await refreshProfile();
    navigate("#/");
  } catch (err) {
    unlockState.passphrase = "";
    unlockState.error = err.message;
    unlockState.busy = false;
    render();
  }
};

export const resetOnboarding = async () => {
  if (
    !confirm(
      "Reset onboarding? This deletes the stored token and connection profile but preserves scan history.",
    )
  ) {
    return;
  }
  await api("POST", "/api/onboarding/reset");
  clearUnlock();
  clearWizard();
  await refreshProfile();
  navigate("#/onboarding");
};
