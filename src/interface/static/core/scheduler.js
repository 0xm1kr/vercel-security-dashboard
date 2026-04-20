/**
 * Indirect render scheduler.
 *
 * Feature modules import `render` from here so they can request a
 * re-render after mutating their slice. The actual render function is
 * registered once by the bootstrap code via `setRenderer`. This breaks
 * what would otherwise be a circular import between the app shell and
 * each feature view.
 */
let renderFn = () => {};
let scheduled = false;

export const setRenderer = (fn) => {
  renderFn = fn;
};

export const render = () => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    renderFn();
  });
};

/** Render synchronously, bypassing the microtask queue (tests / bootstrap). */
export const renderNow = () => {
  scheduled = false;
  renderFn();
};
