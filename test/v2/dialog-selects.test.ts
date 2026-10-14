// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindDialogSelects } from "../../src/ui/dialog-selects";

const disposers: Array<() => void> = [];
function mount() {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = '<form><label>Escuela<select name="school"><option value="abjuration">Abjuración</option><option value="disabled" disabled>No disponible</option><option value="divination">Adivinación</option><option value="evocation">Evocación</option></select></label><label>Otra elección<select name="other"><option value="one">Única</option></select></label><button type="button" data-close>Cerrar</button></form>';
  document.body.append(dialog); dialog.showModal();
  const binding = bindDialogSelects(dialog); disposers.push(binding.dispose);
  const select = dialog.querySelector<HTMLSelectElement>('[name="school"]')!;
  const button = dialog.querySelector<HTMLButtonElement>('[data-dialog-select="school"]')!;
  const panel = select.closest<HTMLElement>(".dialog-select-panel")!;
  return { dialog,select,button,panel,binding };
}
const key = (target: HTMLElement, value: string, shiftKey = false) => target.dispatchEvent(new KeyboardEvent("keydown", { key: value,shiftKey,bubbles: true,cancelable: true }));
afterEach(() => { disposers.splice(0).forEach((dispose) => dispose()); document.body.replaceChildren(); });

describe("dialog-contained selections", () => {
  it("uses only in-document listboxes, keeps form values and labels them accessibly", () => {
    const { dialog,select,button,panel } = mount();
    for (const list of dialog.querySelectorAll<HTMLSelectElement>("select")) expect(list.size).toBeGreaterThan(1);
    expect(panel.hidden).toBe(true);
    expect(new FormData(dialog.querySelector("form")!).get("school")).toBe("abjuration");
    expect(select.labels[0]!.textContent).toBe("Escuela");
    expect(button.getAttribute("aria-controls")).toBe(select.id);
    button.click();
    expect(panel.hidden).toBe(false);
    expect(panel.closest("dialog")).toBe(dialog);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(select);
  });
  it("commits a mouse selection once and returns focus to the trigger", () => {
    const { dialog,select,button,panel } = mount(), changed = vi.fn();
    dialog.querySelector("form")!.addEventListener("change",changed);
    button.click(); select.value = "evocation"; select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(button.textContent).toContain("Evocación");
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });
  it("supports arrow navigation without submitting intermediate values and skips disabled options", () => {
    const { dialog,select,button,panel } = mount(), changed = vi.fn();
    dialog.querySelector("form")!.addEventListener("change",changed);
    key(button,"ArrowDown"); key(select,"ArrowDown");
    expect(select.value).toBe("divination");
    expect(changed).not.toHaveBeenCalled();
    expect(panel.hidden).toBe(false);
    key(select,"Enter");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(panel.hidden).toBe(true);
    expect(button.textContent).toContain("Adivinación");
  });
  it("cancels browsing with Escape before allowing the tutorial itself to close", () => {
    const { dialog,select,button,panel } = mount(), canceled = vi.fn();
    dialog.addEventListener("cancel",canceled);
    button.click(); key(select,"End");
    const cancel = new Event("cancel", { cancelable: true }); dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true); expect(canceled).not.toHaveBeenCalled();
    expect(select.value).toBe("abjuration"); expect(panel.hidden).toBe(true); expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new Event("cancel", { cancelable: true })); expect(canceled).toHaveBeenCalledTimes(1);
    button.click(); key(select,"End"); key(select,"Escape");
    expect(select.value).toBe("abjuration"); expect(panel.hidden).toBe(true);
  });
  it("moves focus on Tab and closes the old list when another field opens", () => {
    const { dialog,select,button,panel } = mount(), other = dialog.querySelector<HTMLButtonElement>('[data-dialog-select="other"]')!;
    button.click(); key(select,"End"); key(select,"Tab");
    expect(panel.hidden).toBe(true); expect(select.value).toBe("abjuration"); expect(document.activeElement).toBe(other);
    button.click(); other.click();
    expect(panel.hidden).toBe(true); expect(other.getAttribute("aria-expanded")).toBe("true");
    dialog.querySelector("[data-close]")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(other.getAttribute("aria-expanded")).toBe("false");
  });
  it("searches labels ignoring accents and dismisses lists on loss of focus or disposal", () => {
    const { select,button,panel,binding } = mount();
    button.click(); key(select,"e"); key(select,"v");
    expect(select.value).toBe("evocation");
    key(select,"Escape"); expect(select.value).toBe("abjuration");
    button.click(); window.dispatchEvent(new Event("blur")); expect(panel.hidden).toBe(true);
    button.click(); binding.dispose(); expect(panel.hidden).toBe(true); expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
