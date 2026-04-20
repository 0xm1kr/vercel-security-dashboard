import { el } from "../../core/dom.js";

export const Card = (children) => el("section", { class: "card" }, children);
