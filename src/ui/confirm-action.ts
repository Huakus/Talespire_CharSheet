/** Confirmation inside the document also works in the TaleSpire WebView. */
export function confirmAction(title: string, message: string, confirmLabel = "Eliminar"): Promise<boolean> {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog"); dialog.className = "confirm-action-dialog";
    dialog.setAttribute("aria-label", title);
    const heading = document.createElement("h2"); heading.textContent = title;
    const text = document.createElement("p"); text.textContent = message;
    const footer = document.createElement("footer");
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Cancelar";
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = confirmLabel; confirm.className = "danger"; confirm.dataset.confirmAction = "true";
    let done = false;
    const finish = (accepted: boolean) => { if (done) return; done = true; dialog.close(); dialog.remove(); resolve(accepted); };
    cancel.addEventListener("click", () => finish(false)); confirm.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
    dialog.addEventListener("close", () => finish(false));
    footer.append(cancel, confirm); dialog.append(heading, text, footer); document.body.append(dialog);
    dialog.showModal(); cancel.focus();
  });
}
