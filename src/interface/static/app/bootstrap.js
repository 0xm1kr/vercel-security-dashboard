import { mount } from "../core/dom.js";
import { installHashListener } from "../core/hash.js";
import { renderNow, setRenderer } from "../core/scheduler.js";
import { Notice } from "../shared/components/notice.js";
import { refreshProfile } from "../features/profile/state.js";
import { renderTopbar } from "./layout.js";
import { resolveView } from "./routing.js";

const root = document.getElementById("root");
const topbarMeta = document.getElementById("topbar-meta");

/** Single source of truth for "paint everything". */
const renderApp = () => {
  renderTopbar(topbarMeta);
  const view = resolveView();
  mount(root, view());
};

export const bootstrap = async () => {
  setRenderer(renderApp);
  installHashListener();
  try {
    await refreshProfile();
  } catch (err) {
    mount(root, Notice({ kind: "error" }, `Failed to load app state: ${err.message}`));
    return;
  }
  renderNow();
};
