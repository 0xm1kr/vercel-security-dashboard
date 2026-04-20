import { el, mount } from "../../core/dom.js";
import { Button } from "../../shared/components/button.js";
import { Notice } from "../../shared/components/notice.js";
import { rotateState } from "./state.js";

const VendorBlock = (vendor) => {
  if (vendor === null) {
    return el("div", { class: "vendor-block" }, [
      el("div", { class: "vendor-name" }, "No vendor recognized"),
      el(
        "div",
        { class: "vendor-link" },
        "Add a rule in vendor-rules.override.json to associate this key.",
      ),
    ]);
  }
  return el("div", { class: "vendor-block" }, [
    el("div", { class: "vendor-name" }, vendor.displayName),
    el(
      "div",
      { class: "vendor-link" },
      el(
        "a",
        { href: vendor.rotateUrl, target: "_blank", rel: "noreferrer" },
        "Open vendor console →",
      ),
    ),
  ]);
};

const TargetCheckbox = (target, checkedTargets, onToggle) =>
  el("label", { class: "target-checkbox" }, [
    el("input", {
      type: "checkbox",
      value: target,
      checked: checkedTargets.has(target),
      onChange: (e) => onToggle(target, e.target.checked),
    }),
    target,
  ]);

const TargetsBlock = (targets, checkedTargets, onToggle) => {
  if (targets.length === 0) {
    return Notice(
      { kind: "warn" },
      "This binding has no targets recorded; the request will use whatever Vercel currently has.",
    );
  }
  return el(
    "div",
    { class: "targets-block" },
    targets.map((t) => TargetCheckbox(t, checkedTargets, onToggle)),
  );
};

/**
 * Build a fresh modal `<dialog>` element. Called once by the
 * controller; the controller swaps the body contents on every open.
 */
export const buildDialog = ({ onClose, onSubmit }) => {
  const dialog = el("dialog", { class: "modal" });
  const form = el("form", { method: "dialog" });
  form.addEventListener("submit", onSubmit);
  dialog.append(form);
  dialog.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.dataset.action === "close") {
      onClose();
    }
  });
  return dialog;
};

/**
 * Render the dialog's body for the currently-active binding.
 * Called every time the dialog is opened.
 */
export const renderDialogBody = ({ dialog, onClose, onSubmitValue }) => {
  const form = dialog.querySelector("form");
  const binding = rotateState.binding;
  if (binding === null) return;

  const checkedTargets = new Set(binding.targets);

  const valueInput = el("input", {
    type: "password",
    id: "rotate-value",
    name: "value",
    autocomplete: "off",
    spellcheck: "false",
    required: true,
    value: rotateState.value,
    onInput: (e) => {
      rotateState.value = e.target.value;
    },
  });

  const noteInput = el("input", {
    type: "text",
    id: "rotate-note",
    name: "note",
    maxlength: "200",
    autocomplete: "off",
    value: rotateState.note,
    onInput: (e) => {
      rotateState.note = e.target.value;
    },
  });

  const submitBtn = Button(
    {
      type: "submit",
      variant: "primary",
      busy: rotateState.busy,
    },
    rotateState.busy ? "Rotating…" : "Rotate",
  );

  const errorEl =
    rotateState.error === null
      ? null
      : el("p", { class: "form-error" }, rotateState.error);

  mount(
    form,
    el("header", { class: "modal-header" }, [
      el("h2", { id: "rotate-title" }, `Rotate ${binding.key}`),
      el(
        "button",
        {
          type: "button",
          class: "icon-button",
          "aria-label": "Close",
          dataset: { action: "close" },
        },
        "×",
      ),
    ]),
    el("section", { class: "modal-body" }, [
      VendorBlock(binding.vendor),
      el(
        "p",
        { class: "modal-help" },
        "Update the secret in the third-party service first, then paste the new value below. The value is sent over HTTPS to Vercel and is never stored locally.",
      ),
      el("label", { class: "form-label", for: "rotate-targets" }, "Targets"),
      TargetsBlock(binding.targets, checkedTargets, (t, on) => {
        if (on) checkedTargets.add(t);
        else checkedTargets.delete(t);
      }),
      el("label", { class: "form-label", for: "rotate-value" }, "New value"),
      valueInput,
      el("label", { class: "checkbox-row", for: "rotate-mark-sensitive" }, [
        el("input", {
          type: "checkbox",
          id: "rotate-mark-sensitive",
          name: "markSensitive",
          checked: rotateState.markSensitive,
          onChange: (e) => {
            rotateState.markSensitive = e.target.checked;
          },
        }),
        el("span", {}, [
          el("strong", {}, "Mark as Sensitive"),
          el(
            "span",
            { class: "checkbox-help" },
            "Vercel will encrypt the value at rest and never return it in read APIs. Recommended; uncheck only if a build step needs to read the value back as plaintext.",
          ),
        ]),
      ]),
      el("label", { class: "form-label", for: "rotate-note" }, "Note (optional)"),
      noteInput,
      errorEl,
    ]),
    el("footer", { class: "modal-footer" }, [
      Button(
        { variant: "secondary", onClick: onClose },
        "Cancel",
      ),
      submitBtn,
    ]),
  );

  // Override the form submit so we use the live value reference (and
  // can pass the current set of checked targets to the controller).
  form.onsubmit = (e) => {
    e.preventDefault();
    onSubmitValue({
      value: valueInput.value,
      targets: Array.from(checkedTargets),
    });
  };

  setTimeout(() => valueInput.focus(), 0);
};
