export const dashboardState = {
  /** Last fetched DashboardSnapshot or null when stale. */
  data: null,
  filters: { project: "", vendor: "", rotated: "all", search: "" },
  sort: { column: null, direction: "asc" },
  /** True while a scan or refresh is in flight. */
  loading: false,
};

/** Mark the dashboard data as stale so the next render refetches. */
export const invalidateDashboard = () => {
  dashboardState.data = null;
};
