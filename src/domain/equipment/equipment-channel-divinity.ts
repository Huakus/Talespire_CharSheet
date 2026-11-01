import type {CharacterV2}from"../character/character-v2";
import type {CharacterInventoryItemV2}from"../character/character-inventory-model";
import{equipmentBearerIssue,inventoryEquipmentDefinition}from"./equipment-live";
import{CLERIC_FEATURES}from"../character/cleric-catalog";
import{martialDefinitions}from"../character/martial-catalog";

export function equipmentChannelCapability(item:CharacterInventoryItemV2){return inventoryEquipmentDefinition(item)?.capabilities.find(c=>c.effects.some(e=>e.kind==="channel-divinity-use"))??null;}
export function equipmentChannelChoices(c:CharacterV2):{key:string;name:string;classKey:"cleric"|"paladin"}[]{
 if(c.builder?.classKey==="cleric"&&c.identity.level>=2){const domain=c.builder.creation.cleric.domain;if(!domain)return[];return[{key:"turn-undead",name:"Expulsar Muertos Vivientes",classKey:"cleric"},...CLERIC_FEATURES[domain].filter(f=>f.channel&&f.level<=c.identity.level).map(f=>({key:f.key,name:f.name,classKey:"cleric"as const}))];}
 if(c.builder?.classKey==="paladin"&&c.identity.level>=3)return martialDefinitions(c.builder).filter(f=>f.pool==="channel").map(f=>({key:f.key,name:f.name,classKey:"paladin"as const}));
 return[];
}
export function equipmentChannelIssue(c:CharacterV2,item:CharacterInventoryItemV2):string{
 const cap=equipmentChannelCapability(item);if(!cap)return"El objeto no concede Canalizar Divinidad.";
 if(!item.quantity||!item.equipped||item.requiresAttunement&&!item.attuned)return"Equipá y sintonizá el amuleto.";
 const issue=equipmentBearerIssue(c,item,cap.id);if(issue)return issue;
 if(!equipmentChannelChoices(c).length)return"No hay opciones guiadas de Canalizar Divinidad disponibles para este personaje.";
 if(c.combat.hitPoints.current<=0||c.combat.conditions.some(s=>["dead","unconscious","incapacitated","stunned","paralyzed","petrified"].includes(s.key)))return"Necesitás poder usar Canalizar Divinidad.";
 if(!item.charges||item.charges.current<1)return"El amuleto recupera este uso al próximo amanecer.";
 if(cap.costs.length!==1||cap.costs[0]!.amount!==1)return"El coste del amuleto no está configurado correctamente.";
 const resources=inventoryEquipmentDefinition(item)!.resources.filter(r=>r.kind!=="spell-storage");
 if(resources.length!==1||resources[0]!.id!==cap.costs[0]!.resourceId||resources[0]!.maximum!==item.charges.maximum)return"La reserva del amuleto no coincide con su poder.";
 return"";
}
/** Called only as part of a validated class action, saved atomically with its effects. No prepaid credits. */
export function spendEquipmentChannelDivinity(c:CharacterV2,itemId:string):void{
 const item=c.inventory.find(i=>i.id===itemId);if(!item)throw new Error("No tenés ese amuleto.");
 const issue=equipmentChannelIssue(c,item);if(issue)throw new Error(issue);
 item.charges!.current--;
}
