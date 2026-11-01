import type { CharacterV2 } from "../character/character-v2";
import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { inventoryEquipmentDefinition, equipmentBearerIssue } from "./equipment-live";

export function equipmentStudyRule(item: CharacterInventoryItemV2) {
  return inventoryEquipmentDefinition(item)?.capabilities.flatMap(c => c.effects).find(e => e.kind === "study") ?? null;
}
export function equipmentStudyHours(item: CharacterInventoryItemV2, readerId: string, day: number): number {
  const rule=equipmentStudyRule(item);
  return rule ? (item.rules?.study?.sessions ?? []).filter(s => s.readerId===readerId && s.day<=day && s.day>day-rule.days).reduce((sum,s)=>sum+s.hours,0) : 0;
}
/** Campaign days, supplied explicitly, never wall-clock days or a fabricated reading completion. */
export function recordEquipmentStudy(character: CharacterV2, item: CharacterInventoryItemV2, day: number, hours: number, updatedAt: string): void {
  const rule=equipmentStudyRule(item);
  if (!rule || rule.kind!=="study" || !item.rules) throw new Error("Este objeto no tiene una lectura mágica configurada.");
  if(character.combat.hitPoints.current<=0||character.combat.conditions.some(c=>["dead","unconscious","stunned","petrified"].includes(c.key)))throw new Error("El lector debe estar consciente y en condiciones de estudiar y practicar.");
  if (item.quantity!==1 || !item.charges || item.charges.current<1) throw new Error("El libro no tiene magia disponible; cada ejemplar se estudia por separado.");
  const issue=equipmentBearerIssue(character,item); if(issue)throw new Error(issue);
  if (!Number.isInteger(day) || day<0 || !Number.isFinite(hours) || hours<=0 || hours>24) throw new Error("Indicá un día de campaña y entre 0 y 24 horas de estudio.");
  const state=item.rules.study ?? {cycle:0,sessions:[]};
  if(state.sessions.some(s=>s.readerId===character.id&&s.day>day))throw new Error("No se puede registrar estudio anterior a la última sesión de este lector.");
  // One physical book cannot be studied by multiple readers for more than 24 hours in a day.
  if(state.sessions.filter(s=>s.day===day).reduce((sum,s)=>sum+s.hours,0)+hours>24)throw new Error("El libro ya tiene registradas más horas de las disponibles en ese día.");
  const source=`${item.id}:${state.cycle}`;
  if(character.equipmentBenefits.some(b=>b.source===source))throw new Error("Esta lectura ya otorgó su beneficio.");
  state.sessions.push({readerId:character.id,day,hours}); item.rules.study=state;
  if(equipmentStudyHours(item,character.id,day)>=rule.hours){
    character.equipmentBenefits.push({source,name:item.name,ability:rule.ability,increase:rule.increase,maximumIncrease:rule.maximumIncrease,completedAt:updatedAt});
    item.charges.current--; state.sessions=[];
  }
}
