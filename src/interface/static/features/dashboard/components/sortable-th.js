import { el } from "../../../core/dom.js";
import { cycleSort } from "../actions.js";
import { dashboardState } from "../state.js";

const indicator = (column) => {
  if (dashboardState.sort.column !== column) return " ↕";
  return dashboardState.sort.direction === "asc" ? " ↑" : " ↓";
};

const ariaSort = (column) => {
  if (dashboardState.sort.column !== column) return "none";
  return dashboardState.sort.direction === "asc" ? "ascending" : "descending";
};

export const SortableTh = ({ column, label }) => {
  const isActive = dashboardState.sort.column === column;
  return el(
    "th",
    {
      class: `sortable ${isActive ? "sorted" : ""}`.trim(),
      role: "button",
      tabindex: "0",
      "aria-sort": ariaSort(column),
      onClick: () => cycleSort(column),
      onKeydown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cycleSort(column);
        }
      },
    },
    `${label}${indicator(column)}`,
  );
};
