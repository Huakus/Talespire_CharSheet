import { SymbiotePreferences } from "./symbiote-preferences";

export type InterfaceVersion = "classic" | "next";
const preferenceKey = "interface-version";

export function preferredInterface(preferences: SymbiotePreferences): InterfaceVersion {
  return preferences.get(preferenceKey) === "next" ? "next" : "classic";
}

/** Recovery overrides only the presentation, never the campaign or permissions. */
export function startupInterface(preferences: SymbiotePreferences, search: string): InterfaceVersion {
  return new URLSearchParams(search).get("ui") === "classic" ? "classic" : preferredInterface(preferences);
}

export function saveInterfacePreference(preferences: SymbiotePreferences, version: InterfaceVersion): boolean {
  preferences.set(preferenceKey, version);
  return preferences.get(preferenceKey) === version;
}
