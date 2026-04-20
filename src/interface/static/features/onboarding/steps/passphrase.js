import { el } from "../../../core/dom.js";
import { FormField } from "../../../shared/components/form-field.js";
import { passphraseStrengthReason } from "../../../shared/passphrase.js";
import { goToStep, setError } from "../actions.js";
import { wizardState } from "../state.js";
import { WizardFooter } from "../components/wizard-footer.js";

export const PassphraseStep = () => {
  const onContinue = () => {
    const reason = passphraseStrengthReason(wizardState.passphrase);
    if (reason !== null) {
      setError(reason);
      return;
    }
    if (wizardState.passphrase !== wizardState.passphraseConfirm) {
      setError("Passphrases do not match.");
      return;
    }
    goToStep(2);
  };

  return [
    el("h1", {}, "Create a passphrase"),
    el(
      "p",
      {},
      "We use this passphrase to encrypt your Vercel API token on disk (AES-256-GCM with scrypt). The passphrase itself is never stored.",
    ),
    FormField("Passphrase", {
      type: "password",
      id: "wiz-pass",
      value: wizardState.passphrase,
      onInput: (e) => {
        wizardState.passphrase = e.target.value;
      },
    }),
    FormField("Confirm passphrase", {
      type: "password",
      id: "wiz-pass-confirm",
      value: wizardState.passphraseConfirm,
      onInput: (e) => {
        wizardState.passphraseConfirm = e.target.value;
      },
    }),
    el(
      "p",
      {},
      "Minimum 12 characters. Use either three of {lowercase, uppercase, digits, symbols} or 16+ characters. You will be asked for it each time you start the app.",
    ),
    WizardFooter({ onBack: () => goToStep(0), onContinue }),
  ];
};
