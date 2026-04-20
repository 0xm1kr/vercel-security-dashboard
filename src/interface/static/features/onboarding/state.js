/** Steps of the onboarding wizard. */
export const STEPS = ["intro", "passphrase", "token", "team", "finish"];

export const wizardState = {
  step: 0,
  passphrase: "",
  passphraseConfirm: "",
  token: "",
  user: null,
  teams: [],
  team: null,
  mintScoped: false,
  tokenName: "vercel-security-dashboard",
  busy: false,
  error: null,
};

/** Wipe all sensitive fields after success / reset. */
export const clearWizard = () => {
  wizardState.step = 0;
  wizardState.passphrase = "";
  wizardState.passphraseConfirm = "";
  wizardState.token = "";
  wizardState.user = null;
  wizardState.teams = [];
  wizardState.team = null;
  wizardState.mintScoped = false;
  wizardState.tokenName = "vercel-security-dashboard";
  wizardState.busy = false;
  wizardState.error = null;
};
