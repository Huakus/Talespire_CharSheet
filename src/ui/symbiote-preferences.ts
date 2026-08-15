export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = "talespire-charsheet:v2:preference";

function scopedKey(key: string): string {
  return `${PREFIX}:${key}`;
}

export class SymbiotePreferences {
  constructor(private readonly storage: PreferenceStorage | null) {}

  get(key: string): string | null {
    try { return this.storage?.getItem(scopedKey(key)) ?? null; }
    catch { return null; }
  }

  set(key: string, value: string | null): void {
    try {
      if (value === null) this.storage?.removeItem(scopedKey(key));
      else this.storage?.setItem(scopedKey(key), value);
    } catch { /* Las preferencias no deben bloquear el symbiote. */ }
  }

  lastCharacterId(campaignId: string): string | null {
    return this.get(`campaign:${campaignId}:last-character`);
  }

  rememberCharacter(campaignId: string, characterId: string | null): void {
    this.set(`campaign:${campaignId}:last-character`, characterId);
  }

  rememberedAuthEmail(): string {
    return this.get("auth:email") ?? "";
  }

  rememberAuthEmail(email: string | null): void {
    this.set("auth:email", email?.trim().toLocaleLowerCase() || null);
  }
}

export function browserSymbiotePreferences(): SymbiotePreferences {
  try { return new SymbiotePreferences(typeof window === "undefined" ? null : window.localStorage); }
  catch { return new SymbiotePreferences(null); }
}
