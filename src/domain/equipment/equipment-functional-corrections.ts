import { EquipmentDefinitionDraftSchema, type EquipmentDefinitionDraft } from "./equipment-definition";
import { bindReviewedEquipment, inventoryEquipmentDefinition } from "./equipment-live";
import { CharacterInventoryItemV2Schema, type CharacterInventoryItemV2 } from "../character/character-inventory-model";
import type { CatalogMetadata } from "../content/catalog-metadata";

export const EQUIPMENT_CORRECTION_KEYS={
  amulet:"official:equipment:es:9b9bc630f8db9ca7d472176a",
  boots:"official:equipment:es:1a642ca8b6c9c5446ce9f228",
  dagger:"gm:equipment:1b428562-bbef-4bec-8445-a76f7e16f854",
  tome:"official:equipment:es:6f6157682bba7d1b46c44ff2",
} as const;
const stixIds=["chr_2de8dab74a76cdd8d2b0d37cc84725ea","chr_c0d4a321021830d8dc5e7313710d762a"];
export function correctedEquipmentDefinition(key:string,input:EquipmentDefinitionDraft):EquipmentDefinitionDraft {
  const d=EquipmentDefinitionDraftSchema.parse(input);
  if(key===EQUIPMENT_CORRECTION_KEYS.dagger){
    for(const req of [d.requirements,...d.capabilities.map(c=>c.requirements)])for(const bearer of req.bearer){
      if(bearer.kind==="other"&&bearer.keys.includes(stixIds[0]!))bearer.keys=[...new Set([...bearer.keys,...stixIds])];
    }
  }
  if(key===EQUIPMENT_CORRECTION_KEYS.amulet){
    const c=d.capabilities.find(c=>c.id==="wisdom-saves-bonus");
    if(c)c.execution={mode:"automatic",handler:"equipment-passive-bonus",explanation:"Aplica +1 exclusivamente a las salvaciones de Sabiduría mientras está equipado y sintonizado.",pendingAutomation:[]};
  }
  if(key===EQUIPMENT_CORRECTION_KEYS.tome){
    const c=d.capabilities.find(c=>c.id==="official-use");
    if(!c)throw new Error("TOME_CAPABILITY_MISSING");
    c.name="Estudio del tomo";c.activation="other";c.duration="48 horas de estudio dentro de seis días";c.requirements.presence="possessed";
    c.effects=[{id:"study-wisdom",kind:"study",condition:"Completar el estudio; la magia del libro debe estar disponible.",ability:"wisdom",hours:48,days:6,increase:2,maximumIncrease:2}];
    c.execution={mode:"automatic",handler:"equipment-study",explanation:"Registra sesiones de estudio, aplica el aumento permanente de Sabiduría y su máximo, y consume la magia del ejemplar.",pendingAutomation:[]};
  }
  return EquipmentDefinitionDraftSchema.parse(d);
}

/** A narrowly scoped repair. Instance identity, quantity, equipment and counters never reset. */
export function refreshCorrectedEquipment(item:CharacterInventoryItemV2,definition:EquipmentDefinitionDraft,catalog:CatalogMetadata|null,key:string):CharacterInventoryItemV2 {
  const old=inventoryEquipmentDefinition(item),{rules:previous,...fields}=item;
  const generated=bindReviewedEquipment({...fields,features:fields.features.filter(f=>!definition.capabilities.some(c=>c.id===f.id))},definition,{preserveName:true});
  const result=structuredClone(item);
  result.rules={...generated.rules!,...previous,definition:JSON.parse(JSON.stringify(definition))};
  result.catalog=catalog;
  result.features=generated.features.map(f=>{
    const before=item.features.find(b=>b.id===f.id);
    return before?{...f,order:before.order,active:before.active,toggleable:before.toggleable,uses:before.uses}:f;
  });
  if(key===EQUIPMENT_CORRECTION_KEYS.amulet){
    const wis=(b:CharacterInventoryItemV2['bonuses'][number])=>b.category.toLowerCase()==="saves"&&["wis","wisdom"].includes(b.key.toLowerCase());
    result.bonuses=[...item.bonuses.filter(b=>!wis(b)),{category:"saves",key:"wisdom",value:1,valueSource:null,advantage:false,disadvantage:false}];
    result.features=result.features.map(f=>({...f,bonuses:f.bonuses.filter(b=>!wis(b))}));
  }
  if(key===EQUIPMENT_CORRECTION_KEYS.tome){
    result.features=result.features.map(f=>f.id==="official-use"?{...f,kind:"other",active:false,toggleable:false,showInActions:false}:f);
  }
  if(old&&old.id!==definition.id)throw new Error("CORRECTION_IDENTITY_CHANGED");
  return CharacterInventoryItemV2Schema.parse(result);
}
