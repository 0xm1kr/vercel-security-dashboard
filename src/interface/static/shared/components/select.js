import { el } from "../../core/dom.js";

/**
 * <select> with placeholder + value-driven options.
 *
 *   Select({
 *     id: "team",
 *     placeholder: "— Select a team —",
 *     options: teams.map((t) => ({ value: t.id, label: t.name })),
 *     value: state.teamId,
 *     onChange: (v) => { state.teamId = v; render(); },
 *   })
 */
export const Select = ({ id, placeholder, options, value, onChange }) => {
  const select = el("select", {
    id,
    onChange: (e) => onChange(e.target.value),
  });
  if (placeholder !== undefined) {
    select.append(el("option", { value: "" }, placeholder));
  }
  for (const o of options) {
    const opt = el("option", { value: o.value }, o.label);
    if (o.value === value) opt.setAttribute("selected", "");
    select.append(opt);
  }
  return select;
};
