import type {CharacterV2} from "../character/character-v2";
import type {CharacterActionV2} from "../character/character-action-model";
import type {CharacterInventoryItemV2} from "../character/character-inventory-model";
import {equipmentBearerIssue,inventoryEquipmentDefinition} from "./equipment-live";
import {parseDiceExpression} from "../dice/dice-expression";
import {projectActionDamageBonus} from "../character/character-projection";

export type WeaponHitOutcome="hit"|"critical"|"natural-20";
export interface WeaponDamageComponent {name:string;expression:string;damageType:string}
export function hasNativeWeaponEffects(item:CharacterInventoryItemV2):boolean {
 return (inventoryEquipmentDefinition(item)?.capabilities??[]).some(c=>["vicious-natural-20","flaming-hit","phase-blade"].includes(c.id));
}
export function criticalDamageExpression(expression:string):string {
 return parseDiceExpression(expression).map((term,i)=>`${term.sign<0?"-":i?"+":""}${term.sides===null?term.count:`${term.count*2}d${term.sides}`}`).join("");
}
/** The natural die is confirmed explicitly: an expanded critical range never counts as a natural 20. */
export function projectWeaponHitDamage(character:CharacterV2,action:CharacterActionV2,outcome:WeaponHitOutcome,includePhaseBlade=true):WeaponDamageComponent[] {
 if(!["hit","critical","natural-20"].includes(outcome))throw new Error("Seleccioná el resultado real del impacto.");
 const item=character.inventory.find(i=>i.id===action.inventoryItemId);
 if(!item||!item.weapon||item.quantity<1||!item.equipped||item.requiresAttunement&&!item.attuned||equipmentBearerIssue(character,item))throw new Error("El arma debe estar equipada y, si corresponde, sintonizada y disponible para el portador.");
 const crit=outcome!=="hit",bonus=projectActionDamageBonus(character,action),base=action.damageExpression;
 const results:WeaponDamageComponent[]=[{name:"Arma",expression:`${crit?criticalDamageExpression(base):base}${bonus>0?"+"+bonus:bonus<0?String(bonus):""}`,damageType:action.damageType}];
 for(const cap of inventoryEquipmentDefinition(item)?.capabilities??[]){
  if(equipmentBearerIssue(character,item,cap.id))continue;
  if(cap.id==="vicious-natural-20"&&outcome==="natural-20")for(const e of cap.effects)if(e.kind==="damage")results.push({name:cap.name,expression:e.expression,damageType:e.damageType});
  if(cap.id==="flaming-hit"&&item.features.some(f=>f.id==="flaming-toggle"&&f.active))for(const e of cap.effects)if(e.kind==="damage")results.push({name:cap.name,expression:crit?criticalDamageExpression(e.expression):e.expression,damageType:e.damageType});
  // The extra attack damage follows the PHB 2014 critical rule; fixed bonuses never double.
  if(cap.id==="phase-blade"&&outcome==="natural-20"&&includePhaseBlade)for(const e of cap.effects)if(e.kind==="damage")results.push({name:cap.name,expression:criticalDamageExpression(e.expression),damageType:e.damageType});
 }
 return results;
}
