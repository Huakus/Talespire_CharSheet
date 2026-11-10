// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountInterfaceShell } from "../../src/ui/interface-shell";
import { preferredInterface, saveInterfacePreference, startupInterface } from "../../src/ui/interface-preference";
import { SymbiotePreferences } from "../../src/ui/symbiote-preferences";

const key = "talespire-charsheet:v2:preference:interface-version";
beforeEach(() => { document.body.replaceChildren(); localStorage.clear(); window.history.replaceState(null, "", "/"); });
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); localStorage.clear(); });

function shell(current: "classic" | "next" = "classic", preferences = new SymbiotePreferences(localStorage)) {
  const root = document.createElement("main");
  document.body.append(root);
  const navigate = vi.fn();
  return { root, navigate, ...mountInterfaceShell(root, { current, preferences, navigate }) };
}

describe("local interface selection", () => {
  it("defaults to Actual and ignores invalid values and attempts to force Nueva through a URL", () => {
    const preferences = new SymbiotePreferences(localStorage);
    expect(startupInterface(preferences, "?ui=next")).toBe("classic");
    localStorage.setItem(key, "unknown");
    expect(preferredInterface(preferences)).toBe("classic");
    expect(saveInterfacePreference(preferences, "next")).toBe(true);
    expect(startupInterface(preferences, "")).toBe("next");
    expect(startupInterface(preferences, "?ui=classic")).toBe("classic");
  });

  it("changes only a local preference, without reloading or replacing an active editor", () => {
    localStorage.setItem("campaign-test", "keep");
    const { root, navigate } = shell();
    root.innerHTML = '<input value="Borrador sin guardar">';
    const select = document.querySelector<HTMLSelectElement>(".interface-shell select")!;
    select.value = "next";
    select.dispatchEvent(new Event("change"));
    expect(localStorage.getItem(key)).toBe("next");
    expect(localStorage.getItem("campaign-test")).toBe("keep");
    expect(root.querySelector("input")!.value).toBe("Borrador sin guardar");
    expect(document.querySelector(".interface-shell summary")!.textContent).toBe("Interfaz: Actual");
    expect(document.querySelector('[role="status"]')!.textContent).toContain("próxima recarga");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not share the choice with an independent client storage", () => {
    const independent = new SymbiotePreferences({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    saveInterfacePreference(new SymbiotePreferences(localStorage), "next");
    expect(preferredInterface(independent)).toBe("classic");
  });

  it("reports blocked storage instead of claiming it saved or reloading", () => {
    const { navigate } = shell("classic", new SymbiotePreferences(null));
    const select = document.querySelector<HTMLSelectElement>(".interface-shell select")!;
    select.value = "next";
    select.dispatchEvent(new Event("change"));
    expect(select.value).toBe("classic");
    expect(document.querySelector('[role="status"]')!.textContent).toContain("No se pudo recordar");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("can recover even without storage and survives replacement of the view", () => {
    window.history.replaceState(null, "", "/v2.html?other=keep#anchor");
    const { root, showRecovery, navigate } = shell("next", new SymbiotePreferences(null));
    root.replaceChildren();
    showRecovery();
    document.querySelector<HTMLButtonElement>("[data-interface-recovery]")!.click();
    const target = new URL(navigate.mock.calls[0]![0] as string);
    expect(target.searchParams.get("ui")).toBe("classic");
    expect(target.searchParams.get("other")).toBe("keep");
    expect(target.hash).toBe("#anchor");
  });

  it("removes a forced recovery override after a successful future selection", () => {
    window.history.replaceState(null, "", "/v2.html?ui=classic&other=keep");
    shell();
    const select = document.querySelector<HTMLSelectElement>(".interface-shell select")!;
    select.value = "next";
    select.dispatchEvent(new Event("change"));
    expect(window.location.search).toBe("?other=keep");
    expect(localStorage.getItem(key)).toBe("next");
  });
});
