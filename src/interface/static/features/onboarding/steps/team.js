import { el } from "../../../core/dom.js";
import { Notice } from "../../../shared/components/notice.js";
import { Select } from "../../../shared/components/select.js";
import { goToStep, setError } from "../actions.js";
import { wizardState } from "../state.js";
import { WizardFooter } from "../components/wizard-footer.js";

export const TeamStep = () => {
  const onContinue = () => {
    if (wizardState.team === null) {
      setError("Please pick an organization.");
      return;
    }
    goToStep(4);
  };

  const userLine =
    wizardState.user === null
      ? null
      : el(
          "p",
          {},
          `Authenticated as ${wizardState.user.username}${
            wizardState.user.email ? " (" + wizardState.user.email + ")" : ""
          }.`,
        );

  const body =
    wizardState.teams.length === 0
      ? Notice(
          { kind: "warn" },
          "No teams were returned for this token. Make sure the user has access to a team and that the token is not personal-only.",
        )
      : el("div", { class: "form-row" }, [
          el("label", { class: "form-label", for: "wiz-team" }, "Organization"),
          Select({
            id: "wiz-team",
            placeholder: "— Select an organization —",
            options: wizardState.teams.map((t) => ({
              value: t.id,
              label: `${t.name} (${t.slug})`,
            })),
            value: wizardState.team === null ? "" : wizardState.team.id,
            onChange: (id) => {
              wizardState.team = wizardState.teams.find((t) => t.id === id) ?? null;
            },
          }),
        ]);

  return [
    el("h1", {}, "Choose the organization to scan"),
    userLine,
    body,
    WizardFooter({ onBack: () => goToStep(2), onContinue }),
  ];
};
