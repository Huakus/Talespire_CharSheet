import type {CharacterV2} from "../character/character-v2";
import type {CharacterInventoryItemV2} from "../character/character-inventory-model";
import {equipmentBearerIssue,inventoryEquipmentDefinition} from "./equipment-live";
import {projectAbilityCheckModifier,projectAdjustedRollMode,projectCharacterStatistics} from "../character/character-projection";
import type {RollMode} from "../character/character-checks";

export interface ConditionalEquipmentCheck {label:string;modifier:number;minimum:number;mode:RollMode;issue:string}
/** These buttons explicitly declare the circumstance; the ordinary skill roll stays unchanged. */
export function projectConditionalEquipmentChecks(character:CharacterV2,item:CharacterInventoryItemV2):ConditionalEquipmentCheck[] {
 const definition=inventoryEquipmentDefinition(item),effects=definition?.capabilities.filter(c=>c.activation==="passive").flatMap(c=>c.effects)??[];
 const check=(label:string,keys:string[],modifier:number,rank:number):ConditionalEquipmentCheck=>({label,modifier,minimum:character.builder?.classKey==="rogue"&&character.identity.level>=11&&rank>0?10:1,mode:projectAdjustedRollMode(character,"skills",keys,"normal",true),issue:item.quantity<1?"No quedan unidades.":!item.equipped?"Equipá el objeto para realizar esta prueba.":item.requiresAttunement&&!item.attuned?"Sintonizá el objeto.":equipmentBearerIssue(character,item)|| (character.combat.hitPoints.current<=0||character.combat.conditions.some(c=>["incapacitated","unconscious","stunned","paralyzed","petrified","dead"].includes(c.key))?"Necesitás poder realizar la prueba.":"")});
 const result:ConditionalEquipmentCheck[]=[];
 if(effects.some(e=>e.kind==="defense"&&e.defense==="advantage"&&e.target==="dexterity-stealth"))result.push(check("Sigilo al moverte sin ruido",["stealth","dexterity"],projectCharacterStatistics(character).skills.stealth,character.checks.skills.stealth.proficiency));
 if(effects.some(e=>e.kind==="defense"&&e.defense==="advantage"&&e.target==="strength-leverage")){
  result.push(check("Fuerza para hacer palanca",["strength"],projectAbilityCheckModifier(character,"strength"),0));
  result.push(check("Atletismo para hacer palanca",["athletics","strength"],projectCharacterStatistics(character).skills.athletics,character.checks.skills.athletics.proficiency));
 }
 return result;
}
