// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { EquipmentPreparationPanel } from "../../src/ui/equipment-preparation-panel";
import { EquipmentPreparationPayloadSchema, type EquipmentPreparation } from "../../src/domain/equipment/equipment-preparation";
import { equipmentDraftExamples } from "../fixtures/equipment-definition-drafts";
import { captureEquipmentSource } from "../../src/domain/equipment/equipment-recovery";
import reviewedEquipment from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";

const record = (index = 6): EquipmentPreparation => ({ payload: EquipmentPreparationPayloadSchema.parse({ schemaVersion: 2, kind: "equipment", language: "es", format: "equipment-preparation", definition: equipmentDraftExamples()[index], originals: [], decisions: [] }), catalog: { contentKey: "preparation:one", origin: "gm", tags: ["es", "en_preparacion"], revision: 0 } });
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

function harness(records: EquipmentPreparation[], save?: (value: EquipmentPreparation) => Promise<void>) {
  let stored = structuredClone(records);
  const root = document.createElement("div"); document.body.append(root);
  const saved: EquipmentPreparation[] = [];
  const persist = async (value: EquipmentPreparation) => { saved.push(structuredClone(value)); if (save) await save(value); stored = [{ ...structuredClone(value), catalog: value.catalog ?? { contentKey: "new:key", origin: "gm", tags: ["es", "en_preparacion"], revision: 0 } }]; };
  const render = () => { root.innerHTML = panel.render(); panel.bind(root); };
  const panel = new EquipmentPreparationPanel({ saveEquipmentPreparation: persist, loadPreparations: async () => ({ equipmentPreparations: stored }), prepareExistingEquipment: async () => stored[0]! }, render);
  panel.setContent(records, []); render();
  const click = (selector: string) => root.querySelector<HTMLButtonElement>(selector)!.click();
  const select = () => click("[data-preparation-select]");
  const edit = () => { select(); click("[data-preparation-edit]"); };
  const submit = () => root.querySelector<HTMLFormElement>("[data-preparation-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return { panel, root, saved, render, click, select, edit, submit };
}

describe("equipment preparation GM panel", () => {
  it("shows activation, wearer restrictions, concentration, duration and costs without hiding the recovery condition", () => {
    const item = record();
    item.payload.definition = EquipmentPreparationPayloadSchema.parse({ ...item.payload, definition: reviewedEquipment.find((value) => value.name === "Botas aladas") }).definition;
    const ui = harness([item]); ui.select();
    expect(ui.root.textContent).toContain("12 horas");
    expect(ui.root.textContent).toContain("120");
    expect(ui.root.textContent).toContain("Llevar puesto");
    expect(ui.root.textContent).toContain("Requerida");
    expect(ui.root.querySelector("[data-equipment-capability]")!.textContent).toContain("Concentración");
    expect(ui.saved).toHaveLength(0);
  });

  it("distinguishes variable spell concentration and spell storage from daily charges", () => {
    const item = record();
    item.payload.definition = EquipmentPreparationPayloadSchema.parse({ ...item.payload, definition: reviewedEquipment.find((value) => value.name === "Anillo de almacenamiento de conjuros") }).definition;
    const ui = harness([item]); ui.select();
    expect(ui.root.textContent).toContain("no se recarga por descanso");
    const cast = ui.root.querySelector('[data-equipment-capability="cast-stored-spell"]')!;
    expect(cast.textContent).toContain("Según el conjuro utilizado");
    expect(cast.textContent).toContain("Llevar puesto");
    expect(cast.textContent).toContain("Requerida");
    const store = ui.root.querySelector('[data-equipment-capability="store-spells"]')!;
    expect(store.textContent).toContain("No requerida");
    expect(ui.saved).toHaveLength(0);
  });

  it("includes the SRD attribution beside official text", () => {
    const item = record();
    item.payload.definition.sources.push({ id: "srd-5.1-es-equipment", kind: "srd", title: "SRD 5.1 español", language: "es", rulesEdition: "2014", locator: "PDF oficial, página 70", verified: true });
    const ui = harness([item]); ui.select();
    expect(ui.root.querySelector("[data-equipment-srd-attribution]")!.textContent).toContain("Wizards of the Coast LLC");
    expect(ui.root.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/legalcode.es"]')).not.toBeNull();
  });
  it("keeps the confirmed revision when saving succeeds but refreshing the list fails", async () => {
    const root = document.createElement("div"); document.body.append(root);
    const original = record();
    const saved: EquipmentPreparation[] = [];
    const render = () => { root.innerHTML = panel.render(); panel.bind(root); };
    const panel = new EquipmentPreparationPanel({
      saveEquipmentPreparation: async (value) => { saved.push(structuredClone(value)); return { ...structuredClone(value), catalog: { ...value.catalog!, revision: 3 } }; },
      loadPreparations: async () => { throw new Error("Sin conexión"); },
    }, render);
    panel.setContent([original], []); render();
    root.querySelector<HTMLButtonElement>("[data-preparation-select]")!.click();
    root.querySelector<HTMLButtonElement>("[data-preparation-edit]")!.click();
    root.querySelector<HTMLInputElement>('[name="name"]')!.value = "Nombre confirmado";
    root.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("El borrador se guardó"));
    expect(root.textContent).toContain("Sin conexión");
    expect(root.querySelector("[data-preparation-record] h3")!.textContent).toBe("Nombre confirmado");
    root.querySelector<HTMLButtonElement>("[data-preparation-edit]")!.click();
    root.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]!.catalog!.revision).toBe(3);
  });

  it("fetches drafts only on first opening and permits explicit refresh", async () => {
    const load = vi.fn(async () => ({ equipmentPreparations: [record()] }));
    const root = document.createElement("div"); document.body.append(root);
    const render = () => { root.innerHTML = panel.render(); panel.bind(root); };
    const panel = new EquipmentPreparationPanel({ saveEquipmentPreparation: async () => {}, loadPreparations: load }, render);
    render(); expect(load).not.toHaveBeenCalled();
    const details = root.querySelector<HTMLDetailsElement>("[data-equipment-preparation]")!;
    details.open = true; details.dispatchEvent(new Event("toggle"));
    await vi.waitFor(() => expect(root.textContent).toContain("1 borradores"));
    expect(load).toHaveBeenCalledTimes(1);
    render(); await new Promise((resolve) => setTimeout(resolve, 30));
    expect(load).toHaveBeenCalledTimes(1);
    root.querySelector<HTMLButtonElement>("[data-preparation-refresh]")!.click();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("preserves an open edit during refresh and does not loop after a failed initial load", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValue({ equipmentPreparations: [record()] });
    const root = document.createElement("div"); document.body.append(root);
    const render = () => { root.innerHTML = panel.render(); panel.bind(root); };
    const panel = new EquipmentPreparationPanel({ saveEquipmentPreparation: async () => {}, loadPreparations: load }, render);
    render(); const details = root.querySelector<HTMLDetailsElement>("[data-equipment-preparation]")!;
    details.open = true; details.dispatchEvent(new Event("toggle"));
    await vi.waitFor(() => expect(root.textContent).toContain("Sin conexión"));
    await new Promise((resolve) => setTimeout(resolve, 30)); expect(load).toHaveBeenCalledTimes(1);
    root.querySelector<HTMLButtonElement>("[data-preparation-refresh]")!.click();
    await vi.waitFor(() => expect(root.querySelector("[data-preparation-select]")).not.toBeNull());
    root.querySelector<HTMLButtonElement>("[data-preparation-select]")!.click();
    root.querySelector<HTMLButtonElement>("[data-preparation-edit]")!.click();
    root.querySelector<HTMLInputElement>('[name="name"]')!.value = "Edición sin guardar";
    expect(root.querySelector<HTMLButtonElement>("[data-preparation-refresh]")!.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>("[data-preparation-refresh]")!.click();
    expect(root.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe("Edición sin guardar");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows structured lists and tables, sources, blockers and a visible automation backlog", () => {
    const item = record(); item.payload.definition.capabilities[0]!.execution.pendingAutomation = ["Aplicar automáticamente la resonancia."];
    const ui = harness([item]); ui.select();
    expect(ui.root.querySelectorAll("table")).toHaveLength(1);
    expect(ui.root.textContent).toContain("Primer paso.");
    expect(ui.root.textContent).toContain("Aplicar automáticamente la resonancia.");
    expect(ui.root.textContent).toContain("Qué falta para completar este objeto");
    expect(ui.root.textContent).toContain("Ejemplo técnico sintético");
  });

  it("preserves untouched block structure, exact text, capabilities and original fields when renaming", async () => {
    const item = record();
    const block = item.payload.definition.description[0]!;
    if (block.type === "paragraph") block.text = "\n  Texto exacto.\r\nSegunda línea.  ";
    const list = item.payload.definition.description[1]!;
    if (list.type === "list") list.items[0] = "Un elemento\ncon dos líneas";
    item.payload.definition.aliases = ["Alias\ncon salto", "Otro alias"];
    item.payload.originals = [await captureEquipmentSource("ECE", "old:key", "2026-10-17T00:00:00.000Z", { payload: { customUnknown: [false, 0, null], text: "English text to keep" } })];
    const ui = harness([item]); ui.edit();
    ui.root.querySelector<HTMLInputElement>('[name="name"]')!.value = "Nombre nuevo";
    ui.submit();
    await vi.waitFor(() => expect(ui.saved).toHaveLength(1));
    expect(ui.saved[0]!.payload).toEqual({ ...item.payload, definition: { ...item.payload.definition, name: "Nombre nuevo" } });
    expect(ui.saved[0]!.catalog).toEqual(item.catalog);
  });

  it("keeps invalid unsaved inputs in place and does not write a partially valid object", async () => {
    const ui = harness([record()]); ui.edit();
    ui.root.querySelector<HTMLInputElement>('[name="name"]')!.value = "";
    ui.root.querySelector<HTMLTextAreaElement>('[name="block-0-text"]')!.value = "Texto aún sin guardar";
    const form = ui.root.querySelector("form"); ui.submit();
    expect(ui.saved).toHaveLength(0);
    expect(ui.root.querySelector("form")).toBe(form);
    expect(ui.root.querySelector<HTMLTextAreaElement>('[name="block-0-text"]')!.value).toBe("Texto aún sin guardar");
    expect(ui.root.querySelector<HTMLElement>("[data-preparation-message]")!.hidden).toBe(false);
  });

  it("locks editing while saving, avoids duplicate writes, and restores the editor after a network failure", async () => {
    let fail!: () => void;
    const pending = new Promise<void>((_resolve, reject) => { fail = () => reject(new Error("Sin conexión")); });
    const ui = harness([record()], () => pending); ui.edit();
    ui.root.querySelector<HTMLInputElement>('[name="name"]')!.value = "Cambio conservado";
    ui.submit();
    expect(ui.root.querySelector<HTMLFieldSetElement>("form > fieldset")!.disabled).toBe(true);
    ui.submit(); expect(ui.saved).toHaveLength(1);
    fail();
    await vi.waitFor(() => expect(ui.root.textContent).toContain("Sin conexión"));
    expect(ui.root.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe("Cambio conservado");
    expect(ui.root.querySelector<HTMLFieldSetElement>("form > fieldset")!.disabled).toBe(false);
  });

  it("prevents another preparation from replacing an unsaved draft", async () => {
    const ui = harness([record()]); ui.edit();
    ui.root.querySelector<HTMLInputElement>('[name="name"]')!.value = "Pendiente";
    await ui.panel.prepare("other");
    expect(ui.root.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe("Pendiente");
    expect(ui.root.querySelector<HTMLInputElement>("[data-preparation-import]")!.disabled).toBe(true);
  });

  it("escapes source text and names instead of executing imported HTML", () => {
    const item = record(); item.payload.definition.name = '<img src=x onerror="alert(1)">';
    const block = item.payload.definition.description[0]!;
    if (block.type === "paragraph") block.text = "<script>window.bad=true</script>";
    const ui = harness([item]); ui.select();
    expect(ui.root.querySelector("script")).toBeNull(); expect(ui.root.querySelector("img")).toBeNull();
    expect(ui.root.textContent).toContain("<script>window.bad=true</script>");
  });

  it("exports the complete payload including originals and recovery decisions", async () => {
    const item = record(); item.payload.originals = [await captureEquipmentSource("ECE", "old", "2026-10-17T00:00:00.000Z", { description: "Original" })];
    let blob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => { blob = value as Blob; return "blob:test"; });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const ui = harness([item]); ui.select(); ui.click("[data-preparation-export]");
    expect(JSON.parse(await blob!.text())).toEqual(item.payload);
  });

  it("edits translation provenance and sources while retaining block identity and original rules", async () => {
    const item = record(); const ui = harness([item]); ui.edit();
    ui.root.querySelector<HTMLSelectElement>('[name="source-0-kind"]')!.value = "book";
    ui.root.querySelector<HTMLSelectElement>('[name="source-0-language"]')!.value = "en";
    ui.root.querySelector<HTMLSelectElement>('[name="block-0-provenance"]')!.value = "reviewed-translation";
    ui.root.querySelector<HTMLTextAreaElement>('[name="block-0-text"]')!.value = "Traducción propia revisada.";
    ui.root.querySelector<HTMLTextAreaElement>('[name="capability-0-pending"]')!.value = "Aplicar el efecto al objetivo.\nResolver la recuperación.";
    ui.submit(); await vi.waitFor(() => expect(ui.saved).toHaveLength(1));
    expect(ui.saved[0]!.payload.definition.description[0]).toMatchObject({ id: "text", provenance: "reviewed-translation", text: "Traducción propia revisada." });
    expect(ui.saved[0]!.payload.definition.sources[0]).toMatchObject({ id: "test-source", kind: "book", language: "en" });
    expect(ui.saved[0]!.payload.definition.capabilities[0]!.execution.pendingAutomation).toHaveLength(2);
    expect(ui.saved[0]!.payload.definition.capabilities[0]!.effects).toEqual(item.payload.definition.capabilities[0]!.effects);
  });

  it("adds structured paragraphs, lists and tables without replacing existing blocks", () => {
    const item = record(); const ui = harness([item]); ui.edit();
    ui.click('[data-preparation-add="paragraph"]');
    expect(ui.root.querySelectorAll('textarea[name$="-text"]')).toHaveLength(2);
    expect(ui.root.querySelectorAll("table")).toHaveLength(1);
    expect(ui.root.textContent).toContain("Texto pendiente de completar.");
  });
});
