import { CharacterV2Schema,StableIdSchema,IsoTimestampSchema,type CharacterV2 } from "./character-v2";
import { MartialActionSchema,type MartialAction } from "./martial-model";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { projectInventory } from "./character-projection";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import { ELEMENTAL_DISCIPLINES,elementalKiLimit,martialDefinitions,oathSpells,paladinOath } from "./martial-catalog";
import { monkSpellEntries,paladinPreparationLimit,paladinSpellKeys,replayMartialChoices } from "./martial-builder";
import type { CharacterSpellV2 } from "./character-spell-model";
export function martialRuntime(c:CharacterV2) { return c.builder?.classKey==="monk"?c.spellcasting.monk:c.builder?.classKey==="paladin"?c.spellcasting.paladin:null; }
export const martialFeature=(c:CharacterV2,key:string)=>c.traits.flatMap((g)=>g.traits).find((t)=>t.id===martialRuntime(c)?.resourceIds[key]);
export function martialAvailable(c:CharacterV2,key:string,cost=1) {const t=martialFeature(c,key);return !!t&&t.uses.maximum-t.uses.used>=cost;}
function spend(c:CharacterV2,key:string,amount=1) {if(!Number.isInteger(amount)||amount<0)throw new Error("Gasto inválido.");const t=martialFeature(c,key);if(!t || !martialAvailable(c,key,amount))throw new Error("No quedan usos o puntos suficientes.");t.uses.used+=amount;}
export const martialIncapacitated=(c:CharacterV2)=>c.combat.hitPoints.current<=0||c.combat.conditions.some((p)=>["unconscious","incapacitated","paralyzed","petrified","stunned","dead"].includes(p.key));
export function monkKiCastCost(c:CharacterV2,spell:CharacterSpellV2,slot:number) {
  if(c.builder?.classKey!=="monk" || spell.casting?.source!=="builder:monk") throw new Error("No es un conjuro de ki.");
  const e=monkSpellEntries(c.builder).find((p)=>p.key===spell.casting!.key);if(!e || slot<e.minimumLevel)throw new Error("Este conjuro no está disponible.");
  const extra=slot-e.minimumLevel,cost=e.cost+extra,level=c.identity.level;
  if(extra && (e.source==="shadow"||e.source==="astral"||e.minimumLevel===0 || e.source!=="sun" && (level<5 || !spell.definition?.higherLevels)))throw new Error("Este lanzamiento no permite elevar nivel.");
  if(e.source==="sun" ? cost>Math.floor(level/2) : !["shadow","astral"].includes(e.source)&&cost>elementalKiLimit(level))throw new Error("Superás el máximo de ki por conjuro a este nivel.");
  return cost;
}
export function prepareMartialCast(c:CharacterV2,spell:CharacterSpellV2,slot:number,options:WizardCastOptions) {
  if(martialIncapacitated(c))throw new Error("No podés lanzar mientras estés incapacitado.");
  if(!canCastWithEquippedArmor(c))throw new Error("No podés lanzar con armadura/escudo sin competencia.");
  if(spell.casting?.kind==="ritual" && (!options.mode||["slot","ritual"].includes(options.mode)))return true;
  const runtime=martialRuntime(c);if(runtime)runtime.effects=runtime.effects.filter((e)=>e.key!=="cloak");
  if(spell.casting?.source==="builder:monk") {
    const cost=monkKiCastCost(c,spell,slot);if(options.mode!==`ki-${slot}`)throw new Error("Lanzá este conjuro con su opción de ki.");
    if(cost)spend(c,"ki",cost);recordCast(c,{spell:spell.casting.key,slot,cost});return true;
  }
  if(options.mode && options.mode!=="slot")throw new Error("Este modo no corresponde a este conjuro. Paladín no obtiene rituales de clase.");
  if(spell.casting?.source==="builder:paladin") {if(!spell.prepared)throw new Error("Prepará ese conjuro antes de lanzarlo.");recordCast(c,{spell:spell.casting.key,slot});}
  return false;
}
function recordCast(c:CharacterV2,payload:Record<string,unknown>) {const r=martialRuntime(c);if(r)r.actions.push({operationId:`mcast_${crypto.randomUUID().replaceAll("-","")}`,payload:JSON.stringify(payload)});}
const FREE_ACTIONS=new Set(["deflect","slow-fall","stillness","shadow-step","cloak","opportunist","agile-parry","kensei-shot","unerring","sun-shield","open-hand-technique","relentless","soul-vengeance","scornful","aura-guardian","protective-spirit","improved-smite","quivering-end","fire-snake-hit","elder-heal"]);
export async function performMartialAction(input:CharacterV2,operation:string,actionInput:MartialAction,options:{expectedRevision:number;updatedAt:string}) {
  const c=CharacterV2Schema.parse(input),a=MartialActionSchema.parse(actionInput),operationId=StableIdSchema.parse(operation),updatedAt=IsoTimestampSchema.parse(options.updatedAt),r=martialRuntime(c);
  if(!r||!c.builder)throw new Error("Este control requiere historial guiado de Monje o Paladín.");
  const payload=canonicalJsonStringify(a as unknown as JsonValue),old=r.actions.find((p)=>p.operationId===operationId);if(old){if(old.payload!==payload)throw new Error("La operación ya se usó con otros datos.");return c;}
  if(c.revision!==options.expectedRevision)throw new CharacterRevisionConflictError(options.expectedRevision,c.revision);
  const monk=c.builder.classKey==="monk",level=c.identity.level;
  if(!["elapsed","end-effect","initiative"].includes(a.kind)&&!(a.kind==="feature"&&["undying","diamond","elder-heal"].includes(a.key))&&martialIncapacitated(c))throw new Error("Necesitás poder actuar para usar este rasgo.");
  r.lastResult="";
  if(a.kind==="smite") {
    if(monk||level<2)throw new Error("Castigo Divino requiere Paladín 2.");const slot=c.spellcasting.slots[String(a.slotLevel)];if(!slot||slot.used>=slot.maximum)throw new Error("No queda ese espacio.");slot.used++;
    r.lastResult=`Castigo Divino: ${(Math.min(5,a.slotLevel+1)+(a.undeadOrFiend?1:0))*(a.critical?2:1)}d8 radiante${level>=11?`; Castigo Mejorado adicional: ${a.critical?2:1}d8 radiante`:""}. Aplicá al objetivo del impacto; el daño del arma se tira aparte.`;
  } else if(a.kind==="lay-hands") {
    if(monk||a.points+5*a.cures<1||a.neutralizePoison&&!a.cures)throw new Error("Asigná curación o neutralizaciones de Imposición de Manos; neutralizar veneno requiere gastar cinco puntos.");spend(c,"lay-hands",a.points+5*a.cures);
    if(a.self){c.combat.hitPoints.current=Math.min(c.combat.hitPoints.maximum,c.combat.hitPoints.current+a.points);if(a.neutralizePoison)c.combat.conditions=c.combat.conditions.filter((p)=>p.key!=="poisoned");}
    r.lastResult=`${a.points} PG y ${a.cures} enfermedad(es)/veneno(s) neutralizados. ${a.self?"Curación propia registrada; confirmá qué aflicciones terminan.":"Aplicá al objetivo tocado."}`;
  } else if(a.kind==="prepare") {
    if(monk||level<2)throw new Error("La preparación requiere Paladín 2.");const free=oathSpells(c.builder),list=paladinSpellKeys(c.builder);
    if(new Set(a.keys).size!==a.keys.length||a.keys.some((k)=>!list.includes(k))||a.keys.filter((k)=>!free.includes(k)).length>paladinPreparationLimit(c))throw new Error("Prepará conjuros disponibles distintos hasta mitad de nivel + CAR; juramento no ocupa cupo.");
    c.spellcasting.spells.forEach((s)=>{if(s.casting?.source==="builder:paladin")s.prepared=free.includes(s.casting.key)||a.keys.includes(s.casting.key);});
  } else if(a.kind==="initiative") {
    if(!monk||level<20)throw new Error("Perfección de Uno Mismo requiere Monje 20.");const t=martialFeature(c,"ki")!;if(t.uses.used!==t.uses.maximum)throw new Error("Solo recuperás ki al tirar iniciativa sin puntos restantes.");t.uses.used-=4;
  } else if(a.kind==="elapsed") {r.effects=r.effects.map((e)=>({...e,remainingMinutes:Math.max(0,e.remainingMinutes-a.minutes)})).filter((e)=>e.remainingMinutes>0);}
  else if(a.kind==="end-effect")r.effects=r.effects.filter((e)=>e.key!==a.key);
  else if(a.kind==="feature") {
    const d=martialDefinitions(c.builder).find((d)=>d.key===a.key),discipline=a.key.startsWith("discipline-")?a.key.slice(11):null;
    if(discipline) {
      const v=ELEMENTAL_DISCIPLINES[discipline];if(!monk||!v||v.spell||!replayMartialChoices(c.builder).disciplines.includes(discipline))throw new Error("Disciplina no disponible; los conjuros se lanzan desde su tarjeta.");
      const cost=v.cost+(["water-whip","air-fist"].includes(discipline)?a.amount:0);spend(c,"ki",cost);r.lastResult=`${v.name}: ${v.description}${["water-whip","air-fist"].includes(discipline)?` Daño: ${3+a.amount}d10.`:""}`;
      if(discipline==="fire-snake")r.effects=[...r.effects.filter((e)=>e.key!=="fire-snake"),{key:"fire-snake",remainingMinutes:.1,target:"",amount:0}];
    } else if(a.key==="fire-snake-hit") {
      if(!monk||!r.effects.some((e)=>e.key==="fire-snake"))throw new Error("Activá Fauces y confirmá un impacto del turno.");spend(c,"ki",1);r.lastResult="+1d10 fuego en este impacto.";
    } else if(a.key==="elder-heal") {
      if(monk||!r.effects.some((e)=>e.key==="elder-champion")||c.combat.conditions.some((p)=>p.key==="dead"))throw new Error("Campeón Ancestral debe estar activo al comenzar tu turno y no podés estar muerto.");
      c.combat.hitPoints.current=Math.min(c.combat.hitPoints.maximum,c.combat.hitPoints.current+10);c.combat.deathSaves={successes:0,failures:0};c.combat.conditions=c.combat.conditions.filter((p)=>p.key!=="unconscious");r.lastResult="Comienzo del turno: recuperaste hasta 10 PG.";
    } else if(a.key==="quivering-end") {
      if(!monk||!r.effects.some((e)=>e.key==="quivering"))throw new Error("No hay vibraciones activas.");r.effects=r.effects.filter((e)=>e.key!=="quivering");r.lastResult="Acción en el mismo plano: CON; fallo 0 PG, éxito 10d10 necrótico.";
    } else {
      if(!d||!(d.cost!==undefined||d.pool||d.maximum!==undefined||["divine-sense","cleansing"].includes(d.key)||FREE_ACTIONS.has(d.key)))throw new Error("Este rasgo no tiene una activación disponible a tu nivel.");
      if(a.key==="undying" && (c.combat.hitPoints.current!==0||c.combat.conditions.some((p)=>p.key==="dead")))throw new Error("Centinela exige quedar a 0 sin muerte instantánea.");
      if(monk&&["agile-parry","kensei-shot","deft-strike","sharpen"].includes(a.key)&&!c.inventory.some((i)=>i.equipped&&replayMartialChoices(c.builder!).weapons.some((k)=>BUILDER_WEAPONS_NAME(k)===i.name)))throw new Error("Equipá el arma kensei correspondiente.");
      if(["sharpen","quivering","sacred-weapon","enmity"].includes(a.key)&&!a.target.trim())throw new Error("Identificá el arma o criatura objetivo.");
      const cost=a.key==="sharpen"?a.amount:a.key==="sunburst"?a.amount:d.cost??0;
      if(a.key==="sharpen"&&(a.amount<1||a.amount>3)||a.key==="sunburst"&&a.amount>3)throw new Error("Este rasgo admite como máximo 3 ki (Afilar exige al menos 1).");
      if(d.pool)spend(c,d.pool,cost);else if(d.maximum!==undefined||["divine-sense","cleansing"].includes(a.key))spend(c,a.key);
      if(a.key==="wholeness")c.combat.hitPoints.current=Math.min(c.combat.hitPoints.maximum,c.combat.hitPoints.current+3*level);
      if(a.key==="undying"){c.combat.hitPoints.current=1;c.combat.deathSaves={successes:0,failures:0};c.combat.conditions=c.combat.conditions.filter((p)=>p.key!=="unconscious");}
      if(a.key==="protective-spirit") {if(c.combat.hitPoints.current<=0||c.combat.hitPoints.current>=c.combat.hitPoints.maximum/2||a.amount<1||a.amount>6)throw new Error("Al final del turno, entre 1 PG y menos de la mitad; ingresá el d6 (1–6).");c.combat.hitPoints.current=Math.min(c.combat.hitPoints.maximum,c.combat.hitPoints.current+a.amount+Math.floor(level/2));}
      if(a.key==="stillness")c.combat.conditions=c.combat.conditions.filter((p)=>!["charmed","frightened"].includes(p.key));
      if(["agile-parry","sacred-weapon","sharpen"].includes(a.key)) {
        const held=c.inventory.find((i)=>i.equipped&&i.weapon&&(a.key==="agile-parry"?i.weapon.range==="melee"&&replayMartialChoices(c.builder!).weapons.some((k)=>BUILDER_WEAPONS[k]!.name===i.name):i.id===a.target||i.name===a.target));
        if(!held)throw new Error("Identificá un arma válida que estés sosteniendo.");
        if(a.key==="sharpen"&&(!replayMartialChoices(c.builder!).weapons.some((k)=>BUILDER_WEAPONS[k]!.name===held.name)||held.weapon!.attackBonus!==0&&held.weapon!.damageBonus!==0))throw new Error("Afilar exige arma kensei sin bono mágico existente a ataque y daño.");
        a.target=held.id;
      }
      const minutes=a.key==="quivering"?level*1440:a.key==="agile-parry"||a.key==="kensei-shot"?.1:d.minutes??0;
      if(minutes)r.effects=[...r.effects.filter((e)=>e.key!==a.key),{key:a.key,remainingMinutes:minutes,target:a.target,amount:a.amount}];
      if(a.key==="cloak")r.effects=[...r.effects.filter((e)=>e.key!=="cloak"),{key:"cloak",remainingMinutes:1e9,target:"",amount:0}];
      if(a.key==="sun-shield") { if(r.effects.some((e)=>e.key==="sun-shield"))r.effects=r.effects.filter((e)=>e.key!=="sun-shield");else r.effects.push({key:"sun-shield",remainingMinutes:1e9,target:"",amount:0}); }
      r.lastResult=a.key==="sunburst"?`${2+2*a.amount}d6 radiante; CON éxito: cero.`:d.description;
    }
  }
  r.actions.push({operationId,payload});c.combat.armorClass=projectInventory(c).calculatedArmorClass;return CharacterV2Schema.parse({...c,revision:c.revision+1,metadata:{...c.metadata,updatedAt}});
}
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
const BUILDER_WEAPONS_NAME=(k:string)=>BUILDER_WEAPONS[k]?.name;
export function martialResourceEffects(c:CharacterV2,kind:string) {
  const r=martialRuntime(c);if(!r)return c;
  if(["short-rest","long-rest"].includes(kind))r.effects=r.effects.filter((e)=>(e.key==="cloak"||e.key==="sun-shield"||e.key==="quivering") && e.remainingMinutes>(kind==="short-rest"?60:480)).map((e)=>({...e,remainingMinutes:e.remainingMinutes-(kind==="short-rest"?60:480)}));
  syncMartialEffects(c);
  c.combat.armorClass=projectInventory(c).calculatedArmorClass;return c;
}
export function syncMartialEffects(c:CharacterV2) {
  const r=martialRuntime(c);if(!r)return;
  r.effects=r.effects.filter((e)=>{
    if(e.key==="sacred-weapon")return c.combat.hitPoints.current>0&&!c.combat.conditions.some((p)=>["unconscious","dead"].includes(p.key))&&c.inventory.some((i)=>i.id===e.target&&i.quantity>0&&i.weapon);
    if(e.key==="agile-parry")return !martialIncapacitated(c)&&c.inventory.some((i)=>i.id===e.target&&i.equipped&&i.weapon?.range==="melee");
    return true;
  });
}
export function martialConditionImmune(c:CharacterV2,key:string) {
  if(c.builder?.classKey==="monk"&&c.identity.level>=10&&["poisoned","diseased"].includes(key))return true;
  if(c.builder?.classKey!=="paladin")return false;
  if(c.identity.level>=3&&key==="diseased")return true;
  const conscious=c.combat.hitPoints.current>0&&!c.combat.conditions.some((p)=>["unconscious","dead"].includes(p.key));
  return conscious&&(c.identity.level>=10&&key==="frightened"||c.identity.level>=7&&paladinOath(c.builder)==="devotion"&&key==="charmed");
}
