import { el } from "../../../core/dom.js";
import { Button } from "../../../shared/components/button.js";
import { formatRelative } from "../../../shared/formatters.js";
import { openRotateDialog } from "../../rotate/controller.js";
import { SORT_ACCESSORS } from "../actions.js";
import { dashboardState } from "../state.js";
import { SortableTh } from "./sortable-th.js";

const matchesFilters = (b) => {
  const f = dashboardState.filters;
  if (f.project !== "" && b.projectId !== f.project) return false;
  if (f.vendor !== "") {
    if (b.vendor === null || b.vendor.id !== f.vendor) return false;
  }
  if (f.rotated !== "all" && b.rotationStatus !== f.rotated) return false;
  if (f.search !== "" && !b.key.toLowerCase().includes(f.search.toLowerCase())) {
    return false;
  }
  return true;
};

const sortBindings = (bindings) => {
  const { column, direction } = dashboardState.sort;
  if (column === null) return bindings;
  const accessor = SORT_ACCESSORS[column];
  if (accessor === undefined) return bindings;
  return [...bindings].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av < bv) return direction === "asc" ? -1 : 1;
    if (av > bv) return direction === "asc" ? 1 : -1;
    return 0;
  });
};

const TargetTags = (targets) => {
  if (targets.length === 0) return [el("span", { class: "tag" }, "—")];
  return targets.map((t) => el("span", { class: `tag ${t}` }, t));
};

const VendorCell = (vendor) => {
  if (vendor === null) {
    return el(
      "div",
      { class: "vendor-cell" },
      el("small", {}, "Unrecognized"),
    );
  }
  return el("div", { class: "vendor-cell" }, [
    el("strong", {}, vendor.displayName),
    el(
      "small",
      {},
      el(
        "a",
        { href: vendor.rotateUrl, target: "_blank", rel: "noreferrer" },
        "Open vendor console",
      ),
    ),
  ]);
};

const RotationCell = (binding) =>
  el("span", { class: `status ${binding.rotationStatus}` }, [
    el("span", { class: "dot" }),
    binding.rotationStatus === "rotated"
      ? `rotated ${formatRelative(binding.rotatedAt)}`
      : binding.rotationStatus,
  ]);

const Row = (b) =>
  el("tr", {}, [
    el("td", { "data-label": "Project" }, b.projectName),
    el("td", { "data-label": "Key" }, b.key),
    el("td", { "data-label": "Targets" }, TargetTags(b.targets)),
    el("td", { "data-label": "Type" }, b.type),
    el("td", { "data-label": "Vendor" }, VendorCell(b.vendor)),
    el("td", { "data-label": "Rotation" }, RotationCell(b)),
    el(
      "td",
      { "data-label": "Action" },
      Button(
        {
          disabled: b.rotationStatus === "superseded",
          onClick: () => openRotateDialog(b),
        },
        "Rotate",
      ),
    ),
  ]);

const EmptyState = (totalCount) =>
  el(
    "div",
    { class: "binding-table-wrapper empty-state" },
    totalCount === 0
      ? "No env variables yet. Click “Scan now” to fetch them from Vercel."
      : "No bindings match the current filters.",
  );

export const BindingsTable = ({ bindings }) => {
  const filtered = bindings.filter(matchesFilters);
  if (filtered.length === 0) return EmptyState(bindings.length);
  const rows = sortBindings(filtered).map(Row);

  const table = el("table", { class: "binding-table" }, [
    el(
      "thead",
      {},
      el("tr", {}, [
        el("th", {}, "Project"),
        SortableTh({ column: "key", label: "Key" }),
        el("th", {}, "Targets"),
        el("th", {}, "Type"),
        el("th", {}, "Vendor"),
        el("th", {}, "Rotation"),
        el("th", {}, ""),
      ]),
    ),
    el("tbody", {}, rows),
  ]);
  return el("div", { class: "binding-table-wrapper" }, table);
};
