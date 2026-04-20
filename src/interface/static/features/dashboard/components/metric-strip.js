import { el } from "../../../core/dom.js";
import { formatRelative } from "../../../shared/formatters.js";

const Metric = (label, value) =>
  el("div", { class: "metric" }, [
    el("div", { class: "metric-label" }, label),
    el("div", { class: "metric-value" }, value),
  ]);

export const MetricStrip = ({ data }) => {
  const total = data.bindings.length;
  const rotated = data.bindings.filter((b) => b.rotationStatus === "rotated").length;
  const superseded = data.bindings.filter(
    (b) => b.rotationStatus === "superseded",
  ).length;
  const lastScan = data.recentScans[0] ?? null;
  const lastScanLabel =
    lastScan === null
      ? "never"
      : `${lastScan.bindingsSeen} bindings, ${formatRelative(lastScan.startedAt)}`;
  return el("div", { class: "metric-strip" }, [
    Metric("Bindings", total),
    Metric("Rotated", rotated),
    Metric("Superseded", superseded),
    Metric("Last scan", lastScanLabel),
  ]);
};
