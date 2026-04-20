import { mount } from "../core/dom.js";
import { el } from "../core/dom.js";
import { navigate } from "../core/hash.js";
import { Button } from "../shared/components/button.js";
import { lockSession } from "../features/profile/actions.js";
import { profileState } from "../features/profile/state.js";

/** Render the topbar metadata into the supplied container element. */
export const renderTopbar = (container) => {
  if (profileState.profile === null) {
    mount(container);
    return;
  }
  const lockButton =
    profileState.session === null
      ? Button(
          { variant: "secondary", onClick: () => navigate("#/unlock") },
          "Unlock",
        )
      : Button({ variant: "secondary", onClick: lockSession }, "Lock");
  mount(
    container,
    el("span", {}, `Org: ${profileState.profile.teamName}`),
    lockButton,
  );
};
