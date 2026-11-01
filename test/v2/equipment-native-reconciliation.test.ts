import{describe,it,expect}from"vitest";
import{readFileSync}from"node:fs";
import{EquipmentDefinitionDraftSchema}from"../../src/domain/equipment/equipment-definition";
import{CharacterInventoryItemV2Schema}from"../../src/domain/character/character-inventory-model";
import{normalizeEquipmentDefinition}from"../../src/domain/equipment/equipment-catalog";
import{createCharacter}from"../../src/domain/character/create-character";
import{studyInventoryBook}from"../../src/domain/character/character-inventory";
import{projectAbilityScore,projectAbilityMaximum}from"../../src/domain/character/character-projection";
import{inventoryToolIdentity,projectEquipmentToolCheck}from"../../src/domain/equipment/equipment-tool-checks";
import{createGuidedFighter}from"../../src/domain/character/fighter-builder";
import{advanceGuidedCharacter}from"../../src/domain/character/guided-character-builder";
import{phbFighterCreation,completeFighterChoice}from"../fixtures/phb-fighter-builder";
const rows=JSON.parse(readFileSync("docs/v2/equipment-native-reconciliation-2026-11-01/reviews.json","utf8")).changes as {key:string;scope:string;name:string;definition:unknown;features:unknown;charges:unknown}[];
const time="2026-11-01T15:00:00.000Z",id="inv_11111111111111111111111111111111";
function item(row:typeof rows[number]){return CharacterInventoryItemV2Schema.parse({...normalizeEquipmentDefinition({name:row.name}),id,order:0,group:"Mochila",features:row.features,charges:row.charges,rules:{definition:row.definition,original:{},pending:[],personalDescription:"",slotUsage:{},storage:null}});}
describe("Conciliación nativa verificada",()=>{
 it("resuelve las quince identidades de herramientas con efectos explícitos",()=>{
  const tools=rows.filter(r=>r.scope==="ece"&&EquipmentDefinitionDraftSchema.parse(r.definition).capabilities.some(c=>c.effects.some(e=>e.kind==="tool-check")));
  expect(tools).toHaveLength(15);const c=createCharacter("chr_11111111111111111111111111111111","Prueba",time);c.identity.level=5;
  for(const row of tools){const tool=item(row),identity=inventoryToolIdentity(tool)!;expect(identity).not.toBeNull();c.proficiencies.tools=[identity.aliases[0]!];expect(projectEquipmentToolCheck(c,tool,"intelligence").modifier).toBe(3);c.proficiencies.tools=[];expect(projectEquipmentToolCheck(c,tool,"intelligence").modifier).toBe(0);}
 });
 it("los seis libros registran sus lecturas y aplican exactamente su atributo y su máximo",()=>{
  const books=rows.filter(r=>r.scope==="ece"&&EquipmentDefinitionDraftSchema.parse(r.definition).capabilities.some(c=>c.effects.some(e=>e.kind==="study")));expect(books).toHaveLength(6);
  for(const row of books){let c=createCharacter("chr_11111111111111111111111111111111","Prueba",time);c.identity.level=5;c.combat.hitPoints={current:10,maximum:20,temporary:0};c.inventory=[item(row)];c.inventory[0]!.charges!.current=1;
   const study=EquipmentDefinitionDraftSchema.parse(row.definition).capabilities[0]!.effects[0]!;if(study.kind!=="study")throw Error("fixture");
   const options=()=>({expectedRevision:c.revision,updatedAt:time});c=studyInventoryBook(c,id,0,24,options());c=studyInventoryBook(c,id,1,24,options());
   expect(projectAbilityScore(c,study.ability)).toBe(12);expect(projectAbilityMaximum(c,study.ability)).toBe(22);expect(c.inventory[0]!.charges!.current).toBe(0);
   expect(c.combat.hitPoints.maximum).toBe(study.ability==="constitution"?25:20);
   for(const ability of Object.keys(c.abilities)as (keyof typeof c.abilities)[])if(ability!==study.ability)expect(projectAbilityScore(c,ability)).toBe(10);
  }
 });
 it("conserva el bono permanente de Constitución al subir de nivel sin alterar elecciones del tutorial",async()=>{
  let c=await createGuidedFighter("chr_11111111111111111111111111111111","build_11111111111111111111111111111111",phbFighterCreation("human"),time);
  const control=structuredClone(c),book=rows.find(r=>r.scope==="ece"&&r.name==="Manual de la salud corporal")!;c.inventory.push(item(book));
  c=studyInventoryBook(c,id,0,24,{expectedRevision:c.revision,updatedAt:time});c=studyInventoryBook(c,id,1,24,{expectedRevision:c.revision,updatedAt:time});
  const next=await advanceGuidedCharacter(c,completeFighterChoice(c),time),base=await advanceGuidedCharacter(control,completeFighterChoice(control),time);
  expect(next.combat.hitPoints.maximum-base.combat.hitPoints.maximum).toBe(2);expect(next.equipmentBenefits).toHaveLength(1);expect(next.abilities).toEqual(base.abilities);
 });
});
