interface DialogSelect {
  select: HTMLSelectElement;
  field: HTMLElement;
  button: HTMLButtonElement;
  panel: HTMLElement;
  value: HTMLElement;
  originalIndex: number;
}

let nextId = 0;

/** Use in-page listboxes, avoiding the host WebView's separate select popup. */
export function bindDialogSelects(dialog: HTMLDialogElement) {
  const controls = new Map<HTMLSelectElement, DialogSelect>();
  let active: DialogSelect | null = null;
  let search = "", searchedAt = 0;
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const update = (control: DialogSelect) => { control.value.textContent = control.select.selectedOptions[0]?.textContent ?? "Elegí una opción"; };
  const close = (commit = false, restoreFocus = false) => {
    if (!active) return;
    const control = active;
    active = null;
    if (!commit) control.select.selectedIndex = control.originalIndex;
    control.panel.hidden = true;
    control.select.tabIndex = -1;
    control.button.setAttribute("aria-expanded", "false");
    search = "";
    if (restoreFocus) control.button.focus();
  };
  const open = (control: DialogSelect) => {
    if (control.select.disabled) return;
    close();
    active = control;
    control.originalIndex = control.select.selectedIndex;
    control.panel.hidden = false;
    control.select.tabIndex = 0;
    control.button.setAttribute("aria-expanded", "true");
    control.select.focus();
  };
  const commit = () => {
    if (!active) return;
    const control = active, changed = control.select.selectedIndex !== control.originalIndex;
    close(true, true); update(control);
    if (changed) control.select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const enabledOptions = (control: DialogSelect) => [...control.select.options].map((option,index) => ({ option,index })).filter(({ option }) => !option.disabled && !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled));
  const findByText = (control: DialogSelect, key: string) => {
    const now = Date.now();
    search = now-searchedAt < 700 ? search+key : key; searchedAt = now;
    const options = enabledOptions(control), current = options.findIndex(({ index }) => index === control.select.selectedIndex);
    const ordered = [...options.slice(current+1), ...options.slice(0,current+1)];
    let match = ordered.find(({ option }) => normalize(option.text).startsWith(normalize(search)));
    if (!match && search.length > 1) { search = key; match = ordered.find(({ option }) => normalize(option.text).startsWith(normalize(search))); }
    if (match) control.select.selectedIndex = match.index;
  };
  for (const select of dialog.querySelectorAll<HTMLSelectElement>("select:not([multiple])")) {
    const field = document.createElement("div"); field.className = "dialog-select-field";
    const parent = select.parentElement, label = parent instanceof HTMLLabelElement ? parent : document.createElement("label");
    const id = `dialog-select-${++nextId}`;
    if (parent === label) { select.remove(); label.replaceWith(field); }
    else { select.replaceWith(field); label.textContent = select.getAttribute("aria-label") ?? select.name; }
    select.id ||= id;
    label.id ||= `${id}-label`; label.htmlFor = select.id;
    const button = document.createElement("button");
    button.type = "button"; button.className = "dialog-select-button"; button.disabled = select.disabled;
    button.dataset.dialogSelect = select.name;
    button.setAttribute("aria-haspopup", "listbox"); button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", select.id);
    const value = document.createElement("span"); value.id = `${id}-value`;
    const arrow = document.createElement("span"); arrow.textContent = "▾"; arrow.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-labelledby", `${label.id} ${value.id}`); button.append(value,arrow);
    const panel = document.createElement("div"); panel.className = "dialog-select-panel"; panel.hidden = true;
    // size > 1 always renders options inside the document, never in a host popup.
    select.size = Math.max(2, Math.min(8,select.options.length)); select.tabIndex = -1;
    const control: DialogSelect = { select,field,button,panel,value,originalIndex: select.selectedIndex };
    controls.set(select,control); update(control);
    const help = document.createElement("small"); help.id = `${id}-help`;
    help.textContent = "Elegí con clic o Enter. Flechas para recorrer; Esc para cancelar.";
    select.setAttribute("aria-describedby", [select.getAttribute("aria-describedby"),help.id].filter(Boolean).join(" "));
    panel.append(select,help); field.append(label,button,panel);
    button.addEventListener("click", () => { if (active === control) close(false,true); else open(control); });
    label.addEventListener("click", (event) => { event.preventDefault(); open(control); });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); open(control); }
      else if (event.key.length === 1 && event.key !== " " && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); open(control); findByText(control,event.key); }
    });
    select.addEventListener("change", () => { close(active === control,true); update(control); });
    select.addEventListener("click", () => { if (active === control) commit(); });
    select.addEventListener("keydown", (event) => {
      if (active !== control) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(false,true); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); commit(); }
      else if (event.key === "Tab") {
        event.preventDefault();
        const focusable = [...dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]")].filter((element) => element !== select && element.tabIndex >= 0 && !element.closest("[hidden]") && !element.matches(":disabled"));
        const index = focusable.indexOf(button), next = focusable[(index+(event.shiftKey ? -1 : 1)+focusable.length)%focusable.length];
        close(); next?.focus();
      } else if (["ArrowDown","ArrowUp","Home","End","PageDown","PageUp"].includes(event.key)) {
        event.preventDefault();
        const options = enabledOptions(control), current = options.findIndex(({ index }) => index === select.selectedIndex);
        const target = event.key === "Home" ? 0 : event.key === "End" ? options.length-1 : current + ({ ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }[event.key] ?? 0);
        const option = options[Math.max(0, Math.min(options.length-1,target))];
        if (option) select.selectedIndex = option.index;
      } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); findByText(control,event.key); }
    });
  }
  const outside = (event: Event) => { if (active && event.target instanceof Node && !active.field.contains(event.target)) close(); };
  const cancel = (event: Event) => { if (active) { event.preventDefault(); event.stopImmediatePropagation(); close(false,true); } };
  const blur = () => close();
  dialog.addEventListener("pointerdown", outside, true);
  dialog.addEventListener("cancel", cancel, true);
  window.addEventListener("blur", blur);
  return {
    focus(select: HTMLSelectElement) { controls.get(select)?.button.focus(); },
    dispose() {
      close();
      dialog.removeEventListener("pointerdown", outside, true);
      dialog.removeEventListener("cancel", cancel, true);
      window.removeEventListener("blur", blur);
    },
  };
}
