import { ButtonRow } from "../../../shared/components/button-row.js";
import { Button } from "../../../shared/components/button.js";

/**
 * Standard "Back / Continue" footer used by every wizard step.
 *
 *   WizardFooter({
 *     onBack: () => goToStep(2),
 *     onContinue: handleContinue,
 *     continueLabel: "Verify token",
 *     busy: wizardState.busy,
 *     busyLabel: "Verifying…",
 *   })
 */
export const WizardFooter = ({
  onBack,
  onContinue,
  continueLabel = "Continue",
  busy = false,
  busyLabel,
  backLabel = "Back",
}) =>
  ButtonRow([
    onBack === undefined
      ? null
      : Button({ variant: "secondary", onClick: onBack }, backLabel),
    Button(
      { variant: "primary", busy, onClick: onContinue },
      busy === true && busyLabel !== undefined ? busyLabel : continueLabel,
    ),
  ]);
