import { api } from "../../core/api.js";
import { render } from "../../core/scheduler.js";
import { dashboardState, invalidateDashboard } from "./state.js";

/** Available sort columns and how to derive their comparable value. */
export const SORT_ACCESSORS = {
  key: (b) => b.key.toLowerCase(),
};

/** Click cycle: unsorted → asc → desc → unsorted. */
export const cycleSort = (column) => {
  const s = dashboardState.sort;
  if (s.column !== column) {
    dashboardState.sort = { column, direction: "asc" };
  } else if (s.direction === "asc") {
    dashboardState.sort = { column, direction: "desc" };
  } else {
    dashboardState.sort = { column: null, direction: "asc" };
  }
  render();
};

export const setFilter = (key, value) => {
  dashboardState.filters[key] = value;
  render();
};

export const loadDashboard = async () => {
  dashboardState.data = await api("GET", "/api/dashboard");
};

export const runScan = async () => {
  dashboardState.loading = true;
  render();
  try {
    await api("POST", "/api/scan");
    invalidateDashboard();
  } catch (err) {
    alert(`Scan failed: ${err.message}`);
  } finally {
    dashboardState.loading = false;
    render();
  }
};
