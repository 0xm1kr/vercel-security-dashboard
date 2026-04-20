import { el } from "../../../core/dom.js";
import { Button } from "../../../shared/components/button.js";
import { Select } from "../../../shared/components/select.js";
import { runScan, setFilter } from "../actions.js";
import { dashboardState } from "../state.js";

const STATUS_OPTIONS = [
  { value: "rotated", label: "Rotated" },
  { value: "never", label: "Never rotated" },
  { value: "superseded", label: "Superseded" },
];

export const Toolbar = ({ data }) =>
  el("div", { class: "dashboard-toolbar" }, [
    el("div", { class: "filters" }, [
      Select({
        placeholder: "All projects",
        options: data.projects.map((p) => ({ value: p.id, label: p.name })),
        value: dashboardState.filters.project,
        onChange: (v) => setFilter("project", v),
      }),
      Select({
        placeholder: "All vendors",
        options: data.vendors.map((v) => ({ value: v.id, label: v.displayName })),
        value: dashboardState.filters.vendor,
        onChange: (v) => setFilter("vendor", v),
      }),
      Select({
        placeholder: "All statuses",
        options: STATUS_OPTIONS,
        value:
          dashboardState.filters.rotated === "all"
            ? ""
            : dashboardState.filters.rotated,
        onChange: (v) => setFilter("rotated", v === "" ? "all" : v),
      }),
      el("input", {
        type: "text",
        placeholder: "Filter by key…",
        value: dashboardState.filters.search,
        onInput: (e) => setFilter("search", e.target.value),
      }),
    ]),
    Button(
      {
        variant: "primary",
        busy: dashboardState.loading,
        onClick: runScan,
      },
      dashboardState.loading ? "Scanning…" : "Scan now",
    ),
  ]);
