import { el } from "../../core/dom.js";
import { ButtonRow } from "../../shared/components/button-row.js";
import { Button } from "../../shared/components/button.js";
import { Card } from "../../shared/components/card.js";
import { FormField } from "../../shared/components/form-field.js";
import { Notice } from "../../shared/components/notice.js";
import { resetOnboarding, submitUnlock } from "./actions.js";
import { unlockState } from "./state.js";

export const UnlockView = () => {
  const card = Card([
    el("h1", {}, "Unlock"),
    el(
      "p",
      {},
      "Enter your passphrase to decrypt the stored Vercel API token for this session.",
    ),
    unlockState.error === null ? null : Notice({ kind: "error" }, unlockState.error),
    FormField("Passphrase", {
      type: "password",
      id: "unlock-pass",
      value: unlockState.passphrase,
      autocomplete: "off",
      onInput: (e) => {
        unlockState.passphrase = e.target.value;
      },
    }),
    ButtonRow([
      Button(
        {
          variant: "primary",
          busy: unlockState.busy,
          onClick: submitUnlock,
        },
        unlockState.busy ? "Unlocking…" : "Unlock",
      ),
      Button(
        { variant: "secondary", onClick: resetOnboarding },
        "Reset onboarding",
      ),
    ]),
  ]);
  return el("div", { class: "wizard" }, card);
};
