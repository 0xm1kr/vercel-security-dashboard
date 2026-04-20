import { el } from "../../../core/dom.js";
import { ButtonRow } from "../../../shared/components/button-row.js";
import { Button } from "../../../shared/components/button.js";
import { goToStep } from "../actions.js";

export const IntroStep = () => [
  el("h1", {}, "Connect your Vercel organization"),
  el(
    "p",
    {},
    "This wizard will help you create a Vercel API token, choose the team to scan, and securely store the token on this machine.",
  ),
  el("ol", {}, [
    el("li", {}, "Choose a passphrase used to encrypt the token at rest."),
    el("li", {}, "Open Vercel and create an API token."),
    el("li", {}, "Paste it here so we can verify it."),
    el("li", {}, "Pick the team / organization to scan."),
    el(
      "li",
      {},
      "Optionally mint a narrower, dashboard-only token and revoke the broader one.",
    ),
  ]),
  ButtonRow(
    Button({ variant: "primary", onClick: () => goToStep(1) }, "Get started"),
  ),
];
