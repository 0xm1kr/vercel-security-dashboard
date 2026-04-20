import { el } from "../../core/dom.js";
import { Card } from "../../shared/components/card.js";
import { Notice } from "../../shared/components/notice.js";
import { WizardSteps } from "./components/wizard-steps.js";
import { FinishStep } from "./steps/finish.js";
import { IntroStep } from "./steps/intro.js";
import { PassphraseStep } from "./steps/passphrase.js";
import { TeamStep } from "./steps/team.js";
import { TokenStep } from "./steps/token.js";
import { STEPS, wizardState } from "./state.js";

const STEP_VIEWS = [IntroStep, PassphraseStep, TokenStep, TeamStep, FinishStep];

/** Top-level onboarding wizard view. */
export const OnboardingView = () => {
  const stepIndex = Math.min(Math.max(wizardState.step, 0), STEP_VIEWS.length - 1);
  const errorBlock =
    wizardState.error === null
      ? null
      : Notice({ kind: "error" }, wizardState.error);
  const card = Card([errorBlock, ...STEP_VIEWS[stepIndex]()]);
  return el("div", { class: "wizard" }, [
    WizardSteps({ current: stepIndex, total: STEPS.length }),
    card,
  ]);
};
