/**
 * Tiny imperative DOM builder used by every view.
 *
 *   el("button", { class: "primary", onClick: foo }, "Save")
 *   el("ul", {}, items.map((i) => el("li", {}, i.name)))
 *
 * - `attrs` keys starting with "on" are wired up as event listeners.
 * - `dataset` is an object whose keys become data-* attributes.
 * - Boolean `true` sets the bare attribute (e.g. `disabled`).
 * - `false`, `null`, `undefined` skip the attribute entirely.
 * - Children may be Nodes, primitives, arrays, or null/undefined/false.
 */
export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.setAttribute("style", v);
    else if (k === "dataset") {
      for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) {
      node.setAttribute(k, "");
    } else {
      node.setAttribute(k, v);
    }
  }
  appendChildren(node, children);
  return node;
};

export const appendChildren = (node, children) => {
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
};

export const clear = (node) => {
  while (node.firstChild !== null) node.removeChild(node.firstChild);
};

export const mount = (parent, ...children) => {
  clear(parent);
  appendChildren(parent, children);
};
