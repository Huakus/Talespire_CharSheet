import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";

export const LUCENT_CORE_SUBTYPE = "ece-lucent-core-adapted";
export const CORE_RESONANCES = { green: "Recuerdo · verde", blue: "Umbral · azul", violet: "Revelación · violeta" } as const;
export type CoreResonance = keyof typeof CORE_RESONANCES;
export type LucentCoreState = NonNullable<NonNullable<CharacterInventoryItemV2["rules"]>["lucentCore"]>;
export const isLucentCore = (item: CharacterInventoryItemV2) => Array.isArray(item.rules?.definition.subtypes) && item.rules.definition.subtypes.includes(LUCENT_CORE_SUBTYPE);
export function lucentCoreState(item: CharacterInventoryItemV2): LucentCoreState {
  return item.rules?.lucentCore ?? { resonance: null, active: null, remainingRounds: 0, spentSinceRest: 0, unstable: false, wearCheckPending: false, lastCheckTotal: null };
}
export function coreFeatureIssue(item: CharacterInventoryItemV2, featureId: string): string {
  if (!isLucentCore(item) || !featureId.startsWith("resonance-")) return "";
  const mode = featureId.slice("resonance-".length) as CoreResonance, state = lucentCoreState(item);
  if (state.wearCheckPending) return "Resolvé primero la tirada de desgaste pendiente.";
  if (state.resonance !== mode) return "Primero configurá esta resonancia con la prueba de herramientas CD 12.";
  if (mode === "violet" && state.unstable) return "La inestabilidad impide utilizar Revelación; repará el núcleo.";
  return "";
}
export function activateCoreFeature(item: CharacterInventoryItemV2, featureId: string): CharacterInventoryItemV2 {
  if (!isLucentCore(item) || !featureId.startsWith("resonance-")) return item;
  const mode = featureId.slice("resonance-".length) as CoreResonance, state = lucentCoreState(item);
  const spentSinceRest = state.spentSinceRest + 1;
  return { ...item, rules: { ...item.rules!, lucentCore: { ...state, active: mode, remainingRounds: mode === "green" ? 100 : 10, spentSinceRest, wearCheckPending: state.wearCheckPending || state.spentSinceRest < 3 && spentSinceRest >= 3 } } };
}
export function restLucentCore(item: CharacterInventoryItemV2, event: string): CharacterInventoryItemV2 {
  if (!isLucentCore(item) || event !== "long-rest") return item;
  const state = lucentCoreState(item);
  return { ...item, rules: { ...item.rules!, lucentCore: { ...state, active: null, remainingRounds: 0, spentSinceRest: 0 } } };
}
