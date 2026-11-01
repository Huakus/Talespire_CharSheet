import type { CharacterInventoryItemV2 } from "../domain/character/character-inventory-model";
import { equipmentLastChargeRule } from "../domain/equipment/equipment-last-charge";

export function renderEquipmentLastCharge(item: CharacterInventoryItemV2): string {
  const rule = equipmentLastChargeRule(item);
  if (!rule || !item.rules?.lastChargePending) return "";
  const consequence = {
    destroy: "El ejemplar se destruye.",
    nonmagical: "El objeto permanece en tu inventario sin propiedades mágicas.",
    replace: "El ejemplar cambia a la forma indicada en sus reglas, sin recuperar cargas.",
    keep: "El objeto conserva sus propiedades.",
  }[rule.outcome];
  return `<details class="inventory-last-charge" open>
    <summary>Última carga · ${rule.sides ? "tirada" : "consecuencia"} pendiente</summary>
    <p>${rule.sides ? `Con ${rule.threshold === 1 ? "un 1" : `${rule.threshold} o menos`} en el d${rule.sides}: ` : ""}${consequence}${rule.refillOnMaximum ? ` Con un ${rule.sides}, recupera ${rule.refillOnMaximum} cargas.` : ""} Resolvé esta consecuencia antes de recuperar cargas.</p>
    ${rule.sides ? `<label>Resultado del d${rule.sides}<input type="number" data-equipment-last-charge-roll min="1" max="${rule.sides}" placeholder="Vacío para tirar"></label>` : ""}
    ${rule.refillOnMaximum ? `<label>Cargas recuperadas (${rule.refillOnMaximum}, solo con un ${rule.sides})<input type="number" data-equipment-last-charge-recovery min="1" placeholder="Vacío para tirar"></label>` : ""}
    <p data-equipment-last-charge-status role="status"></p>
    <button type="button" data-equipment-last-charge>${rule.sides ? "Resolver última carga" : "Aplicar consecuencia"}</button>
  </details>`;
}
