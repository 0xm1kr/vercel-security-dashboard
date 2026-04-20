export const unlockState = {
  passphrase: "",
  busy: false,
  error: null,
};

export const clearUnlock = () => {
  unlockState.passphrase = "";
  unlockState.busy = false;
  unlockState.error = null;
};
