import { el } from "../../core/dom.js";
import { render } from "../../core/scheduler.js";
import { Notice } from "../../shared/components/notice.js";
import { loadDashboard } from "./actions.js";
import { BindingsTable } from "./components/bindings-table.js";
import { MetricStrip } from "./components/metric-strip.js";
import { Toolbar } from "./components/toolbar.js";
import { dashboardState } from "./state.js";

/**
 * Returns the dashboard DOM tree, kicking off a fetch if data is stale.
 * The async fetch triggers another render() once it resolves, so the
 * initial render shows a "Loading…" placeholder.
 */
export const DashboardView = () => {
  if (dashboardState.data === null) {
    void (async () => {
      try {
        await loadDashboard();
      } catch (err) {
        dashboardState.data = { __error: err.message };
      } finally {
        render();
      }
    })();
    return el("p", { class: "empty-state" }, "Loading dashboard…");
  }

  if (dashboardState.data.__error !== undefined) {
    return Notice({ kind: "error" }, dashboardState.data.__error);
  }

  const data = dashboardState.data;
  const fragment = document.createDocumentFragment();
  fragment.append(
    MetricStrip({ data }),
    Toolbar({ data }),
    BindingsTable({ bindings: data.bindings }),
  );
  return fragment;
};
