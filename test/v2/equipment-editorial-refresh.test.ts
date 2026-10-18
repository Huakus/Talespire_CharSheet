import { describe, expect, it } from "vitest";
import definitions from "../../docs/v2/equipment-retirement-2026-10-18/tools-context-definitions.json";
import context from "../../docs/v2/equipment-retirement-2026-10-18/tools-context-source.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { refreshEquipmentEditorialDefinition } from "../../src/domain/equipment/equipment-editorial-refresh";
const id="inv_11111111111111111111111111111111";
function fixture() {
  const definition=EquipmentDefinitionDraftSchema.parse(definitions.find(d=>d.name==="Herramientas de carpintero"));
  const item=bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({id,order:7,group:"Artesanía",name:definition.name,quantity:2,unitWeight:6,cost:{quantity:11,unit:"gp"},category:"tool",description:"Mis anotaciones.",properties:[],equipped:true,attuned:false,requiresAttunement:false,usable:false,consumable:false,charges:null,armor:null,weapon:null,bonuses:[]}),definition);
  const next=structuredClone(definition);next.name="Otro nombre editorial";next.revision+=1;
  return{definition,item,next};
}
describe("recover tool context without resetting owned copies",()=>{
  it("preserves instance identity, state, price, annotations, resources, features and raw original",()=>{
    const{item,next}=fixture(),result=refreshEquipmentEditorialDefinition(item,next,item.name,null);
    expect(result.name).toBe(next.name);
    for(const key of ["id","order","group","quantity","unitWeight","cost","equipped","attuned","charges","bonuses","features"] as const)expect(result[key]).toEqual(item[key]);
    expect(result.rules!.original).toEqual(item.rules!.original);
    expect(result.rules!.personalDescription).toBe("Mis anotaciones.");
    expect(item.name).not.toBe(next.name);
  });
  it("keeps a personally named copy and rejects changed identity or mechanical profiles",()=>{
    const{item,next}=fixture();item.name="Herramientas de mi padre";
    expect(refreshEquipmentEditorialDefinition(item,next,"Nombre del catálogo",null).name).toBe(item.name);
    expect(()=>refreshEquipmentEditorialDefinition(item,{...next,id:"other"},"",null)).toThrow("EDITORIAL_IDENTITY_CHANGED");
    expect(()=>refreshEquipmentEditorialDefinition(item,{...next,weight:{value:0,unit:"lb"}},"",null)).toThrow("EDITORIAL_MECHANICS_CHANGED");
    expect(()=>refreshEquipmentEditorialDefinition(item,{...next,resources:[{id:"charges",name:"Cargas",kind:"charges",maximum:3,unit:"cargas",recovery:{kind:"none"},exhaustion:""}]},"",null)).toThrow("EDITORIAL_MECHANICS_CHANGED");
  });
  it("recovers the distinct proficiency rules for all 37 tools, instruments and games",()=>{
    expect(definitions).toHaveLength(37);
    for(const d of definitions){const parsed=EquipmentDefinitionDraftSchema.parse(d);expect(parsed.category).toBe("tool");expect(parsed.description.some(b=>b.type==="paragraph"&&b.text===context.contexts.general.text)).toBe(true);}
    expect(context.contexts.general.text).toContain("no está atado a una única característica");
    expect(context.contexts.artisan.text).toContain("competencia independiente");
    expect(context.contexts.instrument.text).toContain("Los bardos pueden utilizar");
    expect(context.contexts.herbalism.text).toContain("se necesita competencia");
    expect(context.contexts.gaming.text).toContain("Cada tipo de juego");
  });
});
