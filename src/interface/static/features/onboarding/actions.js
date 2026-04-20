import { api, ApiError } from "../../core/api.js";
import { navigate } from "../../core/hash.js";
import { render } from "../../core/scheduler.js";
import { refreshProfile } from "../profile/state.js";
import { clearWizard, wizardState } from "./state.js";

export const goToStep = (step) => {
  wizardState.step = step;
  wizardState.error = null;
  render();
};

export const setError = (message) => {
  wizardState.error = message;
  render();
};

/** Step 2: validate the pasted token + load teams. */
export const verifyTokenAndLoadTeams = async () => {
  if (wizardState.token.length === 0) {
    setError("Token must not be empty.");
    return;
  }
  wizardState.busy = true;
  wizardState.error = null;
  render();
  try {
    const verifyResult = await api("POST", "/api/onboarding/verify", {
      token: wizardState.token,
    });
    if (!verifyResult.ok) {
      wizardState.error = verifyResult.message;
      return;
    }
    wizardState.user = verifyResult.user;
    const teamsResult = await api("POST", "/api/onboarding/teams", {
      token: wizardState.token,
    });
    wizardState.teams = teamsResult.teams;
    wizardState.step = 3;
  } catch (err) {
    wizardState.error = err.message;
  } finally {
    wizardState.busy = false;
    render();
  }
};

/**
 * The 409-on-existing-token + confirm-replace dance is identical for
 * `save` and `mint` so we factor it out. Throws on any other error or
 * if the user declines the confirmation.
 */
const callWithReplaceConfirm = async (path, body, confirmMessage) => {
  try {
    return await api("POST", path, { ...body, replaceExisting: false });
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 409 &&
      (confirmMessage === null || confirm(confirmMessage))
    ) {
      return api("POST", path, { ...body, replaceExisting: true });
    }
    throw err;
  }
};

/** Final step: persist the credentials, optionally mint a scoped token, then unlock. */
export const finishOnboarding = async () => {
  wizardState.busy = true;
  wizardState.error = null;
  render();
  try {
    await callWithReplaceConfirm(
      "/api/onboarding/save",
      {
        passphrase: wizardState.passphrase,
        token: wizardState.token,
        teamId: wizardState.team.id,
        teamName: wizardState.team.name,
      },
      "A Vercel token is already stored on this machine. " +
        "Replace it with the new one? This cannot be undone.",
    );

    if (wizardState.mintScoped) {
      await callWithReplaceConfirm(
        "/api/onboarding/mint",
        {
          passphrase: wizardState.passphrase,
          bootstrapToken: wizardState.token,
          teamId: wizardState.team.id,
          tokenName: wizardState.tokenName,
        },
        null, // already confirmed in the save step
      );
    }

    await api("POST", "/api/session/unlock", {
      passphrase: wizardState.passphrase,
    });
    clearWizard();
    await refreshProfile();
    navigate("#/");
  } catch (err) {
    wizardState.error = err.message;
    wizardState.busy = false;
    render();
  }
};
