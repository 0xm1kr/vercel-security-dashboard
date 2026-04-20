import { el } from "../../../core/dom.js";

/** Progress bar of N pills, showing the active and completed steps. */
export const WizardSteps = ({ current, total }) =>
  el(
    "div",
    { class: "wizard-steps" },
    Array.from({ length: total }, (_, i) =>
      el("div", {
        class: `wizard-step ${i < current ? "done" : ""} ${
          i === current ? "active" : ""
        }`.trim(),
      }),
    ),
  );
