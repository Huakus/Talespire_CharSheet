import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {createCharacter} from "../../src/domain/character/create-character";
import {CharacterInventoryItemV2Schema} from "../../src/domain/character/character-inventory-model";
import {correctedEquipmentDefinition,refreshCorrectedEquipment,EQUIPMENT_CORRECTION_KEYS as keys} from "../../src/domain/equipment/equipment-functional-corrections";
import {equipmentBearerIssue} from "../../src/domain/equipment/equipment-live";
import {projectAbilityScore,projectAbilityMaximum,projectCharacterStatistics} from "../../src/domain/character/character-projection";
import {studyInventoryBook,recoverInventoryItem,useInventoryFeature} from "../../src/domain/character/character-inventory";
import {equipmentStudyHours} from "../../src/domain/equipment/equipment-study";
const base="docs/v2/equipment-functional-audit-2026-11-01/",read=(name:string)=>JSON.parse(readFileSync(base+name,"utf8"));
const rows=Array.from({length:10},(_,n)=>read(`catalog-${String(n).padStart(2,"0")}.json`)).flat();
const now="2026-11-01T15:00:00.000Z",owner="chr_c0d4a321021830d8dc5e7313710d762a";
function session(key:string){
 const row=rows.find(r=>r.key===key),definition=correctedEquipmentDefinition(key,row.payload.rules.definition);
 const item=CharacterInventoryItemV2Schema.parse({...row.payload,id:"inv_11111111111111111111111111111111",order:0,group:"Mochila",catalog:null,rules:{...row.payload.rules,original:{}}});
 const c=createCharacter(owner,"Stix",now);c.inventory=[refreshCorrectedEquipment(item,definition,null,key)];
 c.inventory[0]!.equipped=true;c.inventory[0]!.attuned=true;
 return c;
}
const options=(c:ReturnType<typeof session>)=>({expectedRevision:c.revision,updatedAt:now});
describe("Correcciones verificadas contra el catálogo utilizado",()=>{
 it("reconcilia WIS y wisdom sin duplicar el bono aprobado",()=>{
   const c=session(keys.amulet);expect(projectCharacterStatistics(c).savingThrows.wisdom).toBe(1);
   expect(projectCharacterStatistics(c).savingThrows.strength).toBe(0);
   c.inventory[0]!.attuned=false;expect(projectCharacterStatistics(c).savingThrows.wisdom).toBe(0);
 });
 it("no concede Sabiduría al equipar; completa estudio y retiene aumento y máximo sin el libro",()=>{
   let c=session(keys.tome);const item=c.inventory[0]!;item.charges!.current=1;
   expect(projectAbilityScore(c,"wisdom")).toBe(10);
   c=studyInventoryBook(c,item.id,10,24,options(c));expect(projectAbilityScore(c,"wisdom")).toBe(10);
   c=studyInventoryBook(c,item.id,15,24,options(c));expect(projectAbilityScore(c,"wisdom")).toBe(12);expect(projectAbilityMaximum(c,"wisdom")).toBe(22);
   expect(c.inventory[0]!.charges!.current).toBe(0);
   expect(()=>studyInventoryBook(c,item.id,16,1,options(c))).toThrow(/magia/);
   c.inventory=[];expect(projectAbilityScore(c,"wisdom")).toBe(12);expect(projectAbilityMaximum(c,"wisdom")).toBe(22);
 });
 it("descarta sesiones fuera de la ventana y rechaza estudio imposible sin mutar entrada",()=>{
   let c=session(keys.tome);const item=c.inventory[0]!;item.charges!.current=1;
   c=studyInventoryBook(c,item.id,0,24,options(c));const before=JSON.stringify(c);
   expect(()=>studyInventoryBook(c,item.id,0,1,options(c))).toThrow(/horas/);expect(JSON.stringify(c)).toBe(before);
   c=studyInventoryBook(c,item.id,6,24,options(c));expect(projectAbilityScore(c,"wisdom")).toBe(10);expect(equipmentStudyHours(c.inventory[0]!,c.id,6)).toBe(24);
   expect(()=>studyInventoryBook(c,item.id,5,1,options(c))).toThrow(/anterior/);
 });
 it("exige el siglo de recuperación confirmado y admite otra lectura posterior",()=>{
   let c=session(keys.tome);const item=c.inventory[0]!;item.charges!.current=1;
   c=studyInventoryBook(c,item.id,0,24,options(c));c=studyInventoryBook(c,item.id,1,24,options(c));
   expect(()=>recoverInventoryItem(c,item.id,"other",undefined,options(c))).toThrow(/siglo/);
   c=recoverInventoryItem(c,item.id,"other",undefined,{...options(c),conditionConfirmed:true});
   c=studyInventoryBook(c,item.id,36525,24,options(c));c=studyInventoryBook(c,item.id,36526,24,options(c));
   expect(projectAbilityScore(c,"wisdom")).toBe(14);expect(projectAbilityMaximum(c,"wisdom")).toBe(24);
 });
 it("repara la copia sin reglas de las botas conservando cero cargas",()=>{
   const c=session(keys.boots),item=c.inventory[0]!,row=rows.find(r=>r.key===keys.boots);
   const {rules,...unbound}=item;unbound.charges!.current=0;
   c.inventory=[refreshCorrectedEquipment(unbound,row.payload.rules.definition,null,keys.boots)];
   expect(c.inventory[0]!.charges!.current).toBe(0);
   const next=recoverInventoryItem(c,item.id,"other",undefined,{...options(c),conditionConfirmed:true});expect(next.inventory[0]!.charges!.current).toBe(120);
 });
 it("la variante de Stix admite ambas fichas de Stix y rechaza cualquier otro portador",()=>{
   const c=session(keys.dagger),item=c.inventory[0]!;if(item.charges)item.charges.current=item.charges.maximum;
   expect(equipmentBearerIssue(c,item)).toBe("");
   const cap=item.features.find(f=>f.chargeCost>0)!;expect(()=>useInventoryFeature(c,item.id,cap.id,options(c))).not.toThrow();
   c.id="chr_33333333333333333333333333333333";expect(equipmentBearerIssue(c,item)).not.toBe("");
 });
});
