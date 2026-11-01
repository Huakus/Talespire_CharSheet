import{describe,it,expect}from"vitest";
import{readFileSync}from"node:fs";
import{createCharacter}from"../../src/domain/character/create-character";
import{CharacterInventoryItemV2Schema}from"../../src/domain/character/character-inventory-model";
import{projectConditionalEquipmentChecks}from"../../src/domain/equipment/equipment-conditional-checks";
import{projectAdjustedRollMode}from"../../src/domain/character/character-projection";
const rows=Array.from({length:10},(_,i)=>JSON.parse(readFileSync(`docs/v2/equipment-functional-audit-2026-11-01/catalog-${String(i).padStart(2,"0")}.json`,"utf8"))).flat();
const time="2026-11-01T15:00:00.000Z";
function fixture(name:string){const r=rows.find(r=>r.name===name),c=createCharacter("chr_11111111111111111111111111111111","Prueba",time),item=CharacterInventoryItemV2Schema.parse({...r.payload,id:"inv_11111111111111111111111111111111",order:0,group:"Mochila",equipped:true,rules:{...r.payload.rules,original:{}}});c.inventory=[item];return{c,item};}
describe("Ventaja del equipo limitada a su circunstancia",()=>{
 it("las botas solo ofrecen ventaja en el botón de movimiento silencioso",()=>{const{c,item}=fixture("Botas élficas");c.checks.skills.stealth.proficiency=1;c.identity.level=5;const check=projectConditionalEquipmentChecks(c,item)[0]!;expect(check.modifier).toBe(3);expect(check.mode).toBe("advantage");expect(projectAdjustedRollMode(c,"skills",["stealth"],"normal")).toBe("normal");item.equipped=false;expect(projectConditionalEquipmentChecks(c,item)[0]!.issue).toContain("Equipá");});
 it("la ventaja de moverse silenciosamente se cancela con desventaja, sin borrar esa condición",()=>{const{c,item}=fixture("Botas élficas");c.combat.exhaustion=1;expect(projectConditionalEquipmentChecks(c,item)[0]!.mode).toBe("normal");expect(projectAdjustedRollMode(c,"skills",["stealth"],"normal")).toBe("disadvantage");});
 it("la palanqueta separa la prueba de Fuerza y la de Atletismo sin conceder competencia",()=>{const{c,item}=fixture("Palanqueta");const d=item.rules!.definition as unknown as {capabilities:{effects:unknown[]}[]};d.capabilities[0]!.effects=[{id:"lever",kind:"defense",defense:"advantage",target:"strength-leverage",condition:"Al hacer palanca."}];c.abilities.strength=14;c.identity.level=5;c.checks.skills.athletics.proficiency=1;const checks=projectConditionalEquipmentChecks(c,item);expect(checks.map(c=>c.modifier)).toEqual([2,5]);expect(checks.every(c=>c.mode==="advantage")).toBe(true);expect(projectAdjustedRollMode(c,"skills",["strength"],"normal")).toBe("normal");});
});
