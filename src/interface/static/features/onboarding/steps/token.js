import { el } from "../../../core/dom.js";
import { FormField } from "../../../shared/components/form-field.js";
import { goToStep, verifyTokenAndLoadTeams } from "../actions.js";
import { wizardState } from "../state.js";
import { WizardFooter } from "../components/wizard-footer.js";

export const TokenStep = () => [
  el("h1", {}, "Create and paste a Vercel API token"),
  el("p", {}, [
    "Open the Vercel token page, create a new token (preferably scoped to one team), then paste it below. ",
    el(
      "a",
      { href: "https://vercel.com/account/tokens", target: "_blank", rel: "noreferrer" },
      "Open vercel.com/account/tokens",
    ),
    ".",
  ]),
  FormField("Vercel token", {
    type: "password",
    id: "wiz-token",
    value: wizardState.token,
    autocomplete: "off",
    spellcheck: "false",
    onInput: (e) => {
      wizardState.token = e.target.value;
    },
  }),
  WizardFooter({
    onBack: () => goToStep(1),
    onContinue: verifyTokenAndLoadTeams,
    continueLabel: "Verify token",
    busy: wizardState.busy,
    busyLabel: "Verifying…",
  }),
];
