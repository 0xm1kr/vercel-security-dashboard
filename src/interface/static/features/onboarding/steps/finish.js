import { el } from "../../../core/dom.js";
import { FormField } from "../../../shared/components/form-field.js";
import { render } from "../../../core/scheduler.js";
import { finishOnboarding, goToStep } from "../actions.js";
import { wizardState } from "../state.js";
import { WizardFooter } from "../components/wizard-footer.js";

export const FinishStep = () => {
  const mintBlock = wizardState.mintScoped
    ? [
        FormField("Token name", {
          type: "text",
          id: "wiz-token-name",
          value: wizardState.tokenName,
          onInput: (e) => {
            wizardState.tokenName = e.target.value;
          },
        }),
        el(
          "p",
          {},
          "After this finishes, you can revoke the token you pasted earlier from the Vercel dashboard.",
        ),
      ]
    : null;

  return [
    el("h1", {}, "Save and finish"),
    el(
      "p",
      {},
      `Selected organization: ${wizardState.team.name} (${wizardState.team.slug}).`,
    ),
    el("label", { class: "target-checkbox" }, [
      el("input", {
        type: "checkbox",
        checked: wizardState.mintScoped,
        onChange: (e) => {
          wizardState.mintScoped = e.target.checked;
          render();
        },
      }),
      "Mint a narrower dashboard-only token (recommended)",
    ]),
    mintBlock,
    WizardFooter({
      onBack: () => goToStep(3),
      onContinue: finishOnboarding,
      continueLabel: "Save and continue",
      busy: wizardState.busy,
      busyLabel: "Saving…",
    }),
  ];
};
