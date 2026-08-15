import { describe, expect, it } from "vitest";
import { FormDraftStore } from "../../src/ui/form-draft-store";
import { SymbiotePreferences, type PreferenceStorage } from "../../src/ui/symbiote-preferences";

class MemoryStorage implements PreferenceStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

interface FakeControl {
  name: string;
  value: string;
  tagName: string;
  type?: string;
  checked?: boolean;
}

function fakeForm(controls: FakeControl[]): HTMLFormElement {
  return {
    querySelectorAll: () => controls,
    addEventListener: () => undefined,
  } as unknown as HTMLFormElement;
}

describe("preferencias del symbiote", () => {
  it("recuerda la última hoja por campaña sin mezclar campañas", () => {
    const storage = new MemoryStorage();
    const preferences = new SymbiotePreferences(storage);

    preferences.rememberCharacter("campaign-a", "character-a");
    preferences.rememberCharacter("campaign-b", "character-b");

    expect(preferences.lastCharacterId("campaign-a")).toBe("character-a");
    expect(preferences.lastCharacterId("campaign-b")).toBe("character-b");
    preferences.rememberCharacter("campaign-a", null);
    expect(preferences.lastCharacterId("campaign-a")).toBeNull();
  });

  it("normaliza y elimina el email recordado sin guardar contraseña", () => {
    const storage = new MemoryStorage();
    const preferences = new SymbiotePreferences(storage);

    preferences.rememberAuthEmail("  USER@Example.COM ");
    expect(preferences.rememberedAuthEmail()).toBe("user@example.com");
    expect([...storage.values.values()]).toEqual(["user@example.com"]);

    preferences.rememberAuthEmail(null);
    expect(preferences.rememberedAuthEmail()).toBe("");
  });

  it("no interrumpe la aplicación si el almacenamiento no está disponible", () => {
    const storage: PreferenceStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    const preferences = new SymbiotePreferences(storage);

    expect(preferences.lastCharacterId("campaign-a")).toBeNull();
    expect(() => preferences.rememberCharacter("campaign-a", "character-a")).not.toThrow();
  });
});

describe("borradores de formularios", () => {
  it("restaura texto y controles repetidos al volver al editor", () => {
    const store = new FormDraftStore();
    const original = [
      { name: "name", value: "Mercader del puerto", tagName: "INPUT", type: "text" },
      { name: "actions", value: "barter", tagName: "INPUT", type: "checkbox", checked: true },
      { name: "actions", value: "steal", tagName: "INPUT", type: "checkbox", checked: false },
      { name: "notes", value: "Borrador importante", tagName: "TEXTAREA" },
    ];
    store.capture(fakeForm(original), "shop:port");

    const replacement = [
      { name: "name", value: "", tagName: "INPUT", type: "text" },
      { name: "actions", value: "barter", tagName: "INPUT", type: "checkbox", checked: false },
      { name: "actions", value: "steal", tagName: "INPUT", type: "checkbox", checked: true },
      { name: "notes", value: "", tagName: "TEXTAREA" },
    ];
    expect(store.restore(fakeForm(replacement), "shop:port")).toBe(true);
    expect(replacement).toMatchObject(original);
  });

  it("descarta un borrador de forma explícita", () => {
    const store = new FormDraftStore();
    store.capture(fakeForm([{ name: "name", value: "Ogro", tagName: "INPUT", type: "text" }]), "monster:ogre");
    expect(store.has("monster:ogre")).toBe(true);
    store.clear("monster:ogre");
    expect(store.has("monster:ogre")).toBe(false);
  });
});
