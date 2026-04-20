import { render } from "./scheduler.js";

/** Read the current hash, defaulting to "#/". */
export const currentHash = () => location.hash || "#/";

/** Set the hash; if it's already current, force a re-render. */
export const navigate = (hash) => {
  if (location.hash !== hash) {
    location.hash = hash;
  } else {
    render();
  }
};

/** Wire up hashchange to trigger a re-render. */
export const installHashListener = () => {
  window.addEventListener("hashchange", render);
};
