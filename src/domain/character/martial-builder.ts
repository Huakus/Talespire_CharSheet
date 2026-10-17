import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,BUILDER_ABILITIES,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { validateFeat,distinct } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { MONK_TRADITIONS,PALADIN_OATHS,ELEMENTAL_DISCIPLINES,PALADIN_SLOTS,monkTradition,paladinOath,kenseiEligible,monkWeaponKeys,martialDefinitions,martialDie,oathSpells } from "./martial-catalog";
import { ARTISAN_TOOLS,INSTRUMENTS } from "./phb-character-options";
import { PHB_SPELLS,classSpells } from "./phb-spells";
import { WIZARD_ASI_LEVELS } from "./wizard-catalog";
import { BUILDER_WEAPONS,FIGHTING_STYLES,DWARF_TOOLS } from "./fighter-builder-catalog";
import { MartialRuntimeSchema } from "./martial-model";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectInventory,preferredWeaponAbility,projectUpdatedBuilderSpeed,monkWeapon,monkMartialArts } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
export const paladinPreparationLimit = (c: CharacterV2) => Math.max(1,Math.floor(c.identity.level/2)+abilityModifier(c.abilities.charisma));
export const paladinSpellKeys = (s: CharacterBuilderState,level=s.levels.length+1) => [...new Set([...classSpells("paladin",1,PALADIN_SLOTS[level]!.length),...oathSpells(s,level)])];
export function replayMartialChoices(s: CharacterBuilderState) {
  const disciplines: string[] = [],weapons: string[] = [];
  if (s.classKey === "monk") {
    if (![...ARTISAN_TOOLS,...INSTRUMENTS].includes(s.creation.monk.tool)) throw new Error("Elegí una herramienta de artesano o instrumento musical de monje.");
    if ([...s.creation.background.tools,...(s.creation.dwarfTool ? [DWARF_TOOLS[s.creation.dwarfTool]] : []),...(s.creation.race === "rock-gnome" ? ["Herramientas de hojalatero"] : [])].includes(s.creation.monk.tool)) throw new Error("La herramienta de monje ya está en la raza o el trasfondo; elegí otra o personalizá el trasfondo para evitar duplicados.");
    const initial = s.creation.monk;
    if (initial.tradition || initial.weapons.length || initial.brush || initial.disciplines.length || initial.replacement) throw new Error("La tradición de Monje se elige en nivel 3.");
    const tradition = monkTradition(s);
    for (const step of s.levels) {
      const p=step.monk,level=step.level,milestone=[3,6,11,17].includes(level);
      if (p.tool || (level === 3 ? !p.tradition : p.tradition !== null)) throw new Error("Elegí tradición solo en nivel 3 y herramienta solo al crear.");
      if (tradition === "kensei") {
        const count=level===3 ? 2 : milestone ? 1 : 0;
        if (p.weapons.length !== count || !distinct([...weapons,...p.weapons]) || p.weapons.some((k)=>!kenseiEligible(k)) || level===3 && (BUILDER_WEAPONS[p.weapons[0]!]!.weapon!.range!=="melee" || BUILDER_WEAPONS[p.weapons[1]!]!.weapon!.range!=="ranged") || (level===3 ? !p.brush : !!p.brush)) throw new Error("Kensei requiere armas nuevas válidas: una cuerpo a cuerpo y una a distancia en nivel 3, y una adicional en 6, 11 y 17; calígrafo o pintor solo en 3.");
        weapons.push(...p.weapons);
      } else if (p.weapons.length || p.brush) throw new Error("Estas elecciones requieren Kensei.");
      if (tradition === "four-elements" && milestone) {
        if(level===3) disciplines.push("attunement");
        // Replacement is resolved before the new discipline, so it can never replace
        // the choice being learned at this milestone. Attunement can be replaced.
        if(p.replacement) {
          if(level===3) throw new Error("Las disciplinas anteriores se sustituyen en niveles 6, 11 o 17, incluida Sintonía Elemental.");
          const at=disciplines.indexOf(p.replacement.oldKey),d=ELEMENTAL_DISCIPLINES[p.replacement.newKey];
          if(at<0 || !d || d.level>level || disciplines.includes(p.replacement.newKey)) throw new Error("Sustituí una disciplina anterior por otra disponible y distinta.");
          disciplines[at]=p.replacement.newKey;
        }
        if(p.disciplines.length!==1 || !distinct([...disciplines,...p.disciplines]) || p.disciplines.some((k)=>!ELEMENTAL_DISCIPLINES[k] || ELEMENTAL_DISCIPLINES[k]!.level>level)) throw new Error("Elegí una nueva disciplina elemental disponible y distinta en nivel 3, 6, 11 o 17.");
        disciplines.push(...p.disciplines);
      } else if(p.disciplines.length || p.replacement) throw new Error("Las disciplinas se eligen en Cuatro Elementos 3, 6, 11 y 17.");
    }
  } else {
    if(s.creation.paladin.oath || s.creation.paladin.style || s.creation.paladin.prepared?.length) throw new Error("Paladín recibe estilo/conjuros en nivel 2 y juramento en 3.");
    for (const step of s.levels) {
      const p=step.paladin;
      if(step.level===2 ? !p.style : p.style!==null) throw new Error("Elegí un estilo de Paladín únicamente en nivel 2.");
      if(step.level===3 ? !p.oath : p.oath!==null) throw new Error("Elegí un juramento únicamente en nivel 3.");
      if(p.prepared) {
        const partial={...s,levels:s.levels.filter((l)=>l.level<=step.level)},available=paladinSpellKeys(partial),free=oathSpells(partial),limit=Math.max(1,Math.floor(step.level/2)+abilityModifier(fighterBuilderScores(partial).charisma));
        if(!distinct(p.prepared) || p.prepared.some((k)=>!available.includes(k)) || p.prepared.filter((k)=>!free.includes(k)).length>limit) throw new Error("Prepará conjuros disponibles distintos; mitad de nivel + CAR (mínimo uno), sin contar juramento.");
      }
    }
  }
  return {disciplines,weapons};
}
export function validateMartialCreation(input: FighterCreationInput) {
  const c=FighterCreationSchema.parse(input);if(!["monk","paladin"].includes(c.classKey)) throw new Error("Este recorrido requiere Monje o Paladín.");validateBuilderOrigin(c);
  if(c.equipment.method==="packages") {
    if(c.classKey==="monk" && c.monkWeapon!=="shortsword" && !BUILDER_WEAPONS[c.monkWeapon]?.weapon?.category.startsWith("simple")) throw new Error("Monje empieza con espada corta o cualquier arma sencilla.");
    if(c.classKey==="paladin" && (!BUILDER_WEAPONS[c.equipment.primary]?.weapon?.category.startsWith("martial") || (c.equipment.shield ? c.equipment.secondary!==null : !BUILDER_WEAPONS[c.equipment.secondary ?? ""]?.weapon?.category.startsWith("martial")) || c.paladinSecondary!=="javelins" && !(BUILDER_WEAPONS[c.paladinSecondary]?.weapon?.category.startsWith("simple") && BUILDER_WEAPONS[c.paladinSecondary]?.weapon?.range==="melee"))) throw new Error("Paladín: arma marcial y escudo o dos marciales; cinco jabalinas o un arma sencilla cuerpo a cuerpo.");
  }
  replayMartialChoices({schemaVersion:1,packageVersion:1,ruleset:"dnd5e-2014",classKey:c.classKey,creationOperationId:"build_00000000000000000000000000000000",creation:c,levels:[]});return c;
}
export function validateMartialBuild(input: CharacterBuilderState) {
  const s=CharacterBuilderStateSchema.parse(input);validateMartialCreation(s.creation);const monk=s.classKey==="monk";
  for(const [index,step] of s.levels.entries()) {
    if(step.hpBase>(monk?8:10) || step.hpMethod==="fixed" && step.hpBase!==(monk?5:6)) throw new Error(monk ? "Monje: 5 PG fijos o d8 antes de CON." : "Paladín: 6 PG fijos o d10 antes de CON.");
    if(step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.learn.length || step.magic.cantrips.length || step.magic.replace) throw new Error("Este nivel no concede elecciones de Guerrero.");
    const previous={...s,levels:s.levels.slice(0,index)};
    if(WIZARD_ASI_LEVELS.includes(step.level)) {
      if(step.skipImprovement) {if(step.feat || step.abilityIncrease) throw new Error("La renuncia deja vacías las elecciones.");}
      else if(step.feat) {if(step.abilityIncrease) throw new Error("Elegí mejora o dote.");validateFeat(step.feat,fighterBuilderScores(previous),previous);}
      else if(!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b)=>a+b,0)!==2) throw new Error("Distribuí dos puntos o elegí una dote.");
    } else if(step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel no concede mejora ni dote.");
    if(Object.values(fighterBuilderScores({...s,levels:s.levels.slice(0,index+1)})).some((n)=>n>20)) throw new Error("Los atributos no pueden superar 20.");
  }
  replayMartialChoices(s);return s;
}
export function monkSpellEntries(s: CharacterBuilderState): {key:string;cost:number;source:string;minimumLevel:number}[] {
  const tradition=monkTradition(s),level=s.levels.length+1;
  return [
    ...(tradition==="shadow" ? ["minor-illusion","darkness","darkvision","pass-without-trace","silence"].map((key)=>({key,cost:key==="minor-illusion"?0:2,source:"shadow",minimumLevel:PHB_SPELLS[key]!.level})) : []),
    ...replayMartialChoices(s).disciplines.flatMap((k)=>{const d=ELEMENTAL_DISCIPLINES[k]!;return d.spell ? [{key:d.spell,cost:d.cost,source:k,minimumLevel:PHB_SPELLS[d.spell]!.level}] : [];}),
    ...(tradition==="sun-soul" && level>=6 ? [{key:"burning-hands",cost:2,source:"sun",minimumLevel:1}] : []),
    ...(level>=18 ? [{key:"astral-projection",cost:8,source:"astral",minimumLevel:9}] : []),
  ];
}
export async function applyMartialBenefits(input: CharacterV2,previous: CharacterV2|null=null) {
  const c=CharacterV2Schema.parse(input),s=c.builder!,monk=s.classKey==="monk",key=monk?"monk":"paladin",level=c.identity.level,r=MartialRuntimeSchema.parse(c.spellcasting[key]??{}),replay=replayMartialChoices(s),subclass=monk?monkTradition(s):paladinOath(s);
  c.identity.className=monk?"Monje":"Paladín";c.identity.subclass=monk ? MONK_TRADITIONS[monkTradition(s)!]??"" : PALADIN_OATHS[paladinOath(s)!]??"";c.spellcasting.ability=monk?"wisdom":"charisma";
  const defs: TraitDefinition[]=martialDefinitions(s).map((d)=>({...d}));
  if(monk) {
    for(const d of replay.disciplines) {const v=ELEMENTAL_DISCIPLINES[d]!;defs.push({key:`discipline-${d}`,name:v.name,description:`${v.cost} ki. ${v.description}`});}
    c.proficiencies.weapons=[...new Set([...c.proficiencies.weapons,...monkWeaponKeys(s).map((k)=>BUILDER_WEAPONS[k]!.name)])];
    if(subclass==="drunken-master") {c.checks.skills.performance.proficiency=Math.max(1,c.checks.skills.performance.proficiency) as 1|2;c.proficiencies.tools=[...new Set([...c.proficiencies.tools,"Suministros de cervecero"])];}
    if(subclass==="kensei") c.proficiencies.tools=[...new Set([...c.proficiencies.tools,s.levels.find((l)=>l.level===3)!.monk.brush==="calligrapher"?"Suministros de calígrafo":"Suministros de pintor"])];
    if(level>=14) for(const a of BUILDER_ABILITIES) c.checks.savingThrows[a].proficiency=1;
  } else {
    for(const d of defs) if(d.key==="lay-hands") d.maximum=5*level;else if(d.key==="divine-sense") d.maximum=Math.max(0,1+abilityModifier(c.abilities.charisma));else if(d.key==="cleansing") d.maximum=Math.max(1,abilityModifier(c.abilities.charisma));
    const style=s.levels.find((l)=>l.level===2)?.paladin.style;if(style) defs.push({key:`style-${style}`,name:`Estilo: ${FIGHTING_STYLES[style].name}`,description:FIGHTING_STYLES[style].description});
    for(let n=1;n<=9;n++) c.spellcasting.slots[String(n)]={maximum:PALADIN_SLOTS[level]![n-1]??0,used:c.spellcasting.slots[String(n)]?.used??0};
  }
  const group=await traitGroup(c,key,`${c.identity.className}${c.identity.subclass?` · ${c.identity.subclass}`:""}`,defs);defs.forEach((d,i)=>r.resourceIds[d.key]=group.traits[i]!.id);c.traits=[...c.traits.filter((g)=>g.id!==group.id),group];
  // Removed elemental disciplines must not remain as stale managed traits.
  if(monk) group.traits=group.traits.filter((t)=>!Object.entries(ELEMENTAL_DISCIPLINES).some(([k])=>!replay.disciplines.includes(k) && t.id===r.resourceIds[`discipline-${k}`]));
  const free=oathSpells(s),selection=s.levels.at(-1)?.paladin.prepared,oldDaily=previous?.spellcasting.spells.filter((p)=>p.casting?.source==="builder:paladin" && p.prepared && !oathSpells(previous.builder!).includes(p.casting.key)).map((p)=>p.casting!.key)??[];
  const daily=selection??oldDaily,entries=monk?monkSpellEntries(s):paladinSpellKeys(s).map((k)=>({key:k,cost:0,source:"paladin",minimumLevel:PHB_SPELLS[k]!.level}));
  const filteredEntries=entries.filter((e) => !(monk && e.key === "minor-illusion" && c.spellcasting.spells.some((p) => p.casting?.source !== "builder:monk" && p.casting?.key === e.key)));
  const generated=await Promise.all(filteredEntries.map(async(e,index)=>{const id=await createDeterministicId("spl",c.id,key,e.key),old=c.spellcasting.spells.find((p)=>p.id===id),d=structuredClone(PHB_SPELLS[e.key]!);if(monk && e.source!=="sun") {d.components=d.components.replace(/,?\s*M(?:\s*\([^)]*\))?/g,"");d.material="";}if(e.source==="sun") d.castingTime="1 acción adicional, inmediatamente después de Atacar";return CharacterSpellV2Schema.parse({id,name:d.name,level:d.level,order:old?.order??index,prepared:monk||free.includes(e.key)||daily.includes(e.key),definition:d,effect:old?.effect??{description:"",active:false},casting:{source:`builder:${key}`,key:e.key,ability:monk?"wisdom":"charisma",kind:monk?"slots":"cleric",traitId:null,level:d.level}});}));
  c.spellcasting.spells=[...c.spellcasting.spells.filter((p)=>p.casting?.source!==`builder:${key}`),...generated];c.spellcasting[key]=r;
  if(monk) {
    if(subclass === "sun-soul" && level >= 17 && (previous?.identity.level ?? 0) < 17) r.effects.push({key:"sun-shield",remainingMinutes:1e9,target:"",amount:0});
    await syncMonkActions(c,previous);
  }
  return CharacterV2Schema.parse(c);
}
export async function syncMonkActions(c: CharacterV2,previous: CharacterV2|null=null) {
  if(c.builder?.classKey!=="monk") return;
  const level=c.identity.level,active=monkMartialArts(c),die=martialDie(level),ability=active&&c.abilities.dexterity>c.abilities.strength?"dexterity":"strength",id=await createDeterministicId("act",c.id,"monk","unarmed");
  const old=c.actions.find((a)=>a.id===id),prior=previous??c,priorAbility=monkMartialArts(prior)&&prior.abilities.dexterity>prior.abilities.strength?"dexterity":"strength",selectedAbility=old&&old.ability!==priorAbility?old.ability:ability;
  const oldDie=monkMartialArts(prior)?`1d${martialDie(prior.identity.level)}`:"1",damageOffset=old?old.damageBonus-(old.ability?abilityModifier(c.abilities[old.ability]):0):0;
  const unarmed={id,order:old?.order??c.actions.length,name:old?.name??"Golpe desarmado",categories:["attack","action"] as ("attack"|"action")[],activation:"Acción / Artes Marciales / Ráfaga",reach:"5 ft",ability:selectedAbility as CharacterV2["actions"][number]["ability"],proficient:true,attackBonus:old?.attackBonus??0,damageExpression:old&&old.damageExpression!==oldDie?old.damageExpression:active?`1d${die}`:"1",damageBonus:(selectedAbility?abilityModifier(c.abilities[selectedAbility as keyof typeof c.abilities]):0)+damageOffset,damageType:old?.damageType??"bludgeoning",weaponType:"melee",properties:level>=6?"Ataque mágico para resistencias":"",description:old?.description??"Artes Marciales exige no llevar armadura ni escudo y usar solo armas de monje. Confirmá esas condiciones en cada ataque.",inventoryItemId:null,rollMode:old?.rollMode??"normal"};
  c.actions=c.actions.filter((a)=>a.id!==id);c.actions.push(unarmed);
  for(const a of c.actions) {const item=c.inventory.find((i)=>i.id===a.inventoryItemId);if(!item?.weapon) continue;
    const previousItem=previous?.inventory.find((i)=>i.id===item.id),wasMonk=previous&&previousItem&&monkMartialArts(previous)&&monkWeapon(previous,previousItem),priorAbility=wasMonk&&previous!.abilities.dexterity>previous!.abilities.strength?"dexterity":preferredWeaponAbility(previous?.abilities??c.abilities,item),nextAbility=active&&monkWeapon(c,item)&&c.abilities.dexterity>c.abilities.strength?"dexterity":preferredWeaponAbility(c.abilities,item);
    if(!previous || a.ability===priorAbility) {a.damageBonus+=abilityModifier(c.abilities[nextAbility])-(a.ability ? abilityModifier(c.abilities[a.ability]) : 0);a.ability=nextAbility;}
    const original=item.weapon.damageExpression,priorDie=previous?martialDie(previous.identity.level):4;
    if(!previous || a.damageExpression===original || a.damageExpression===`1d${priorDie}`) {const sides=/^1d(\d+)$/.exec(original);a.damageExpression=active&&monkWeapon(c,item)&&sides&&Number(sides[1])<die?`1d${die}`:original;}
    if(monkWeaponKeys(c.builder).some((k)=>BUILDER_WEAPONS[k]!.name===item.name)) a.proficient=true;
  }
  if(monkTradition(c.builder)==="sun-soul") {const sunId=await createDeterministicId("act",c.id,"monk","sun-bolt"),oldSun=c.actions.find((a)=>a.id===sunId);c.actions=c.actions.filter((a)=>a.id!==sunId);c.actions.push({...unarmed,id:sunId,order:c.actions.length,name:"Rayo de Sol Radiante",reach:"30 ft",ability:"dexterity",attackBonus:oldSun?.attackBonus??0,rollMode:oldSun?.rollMode??"normal",damageBonus:oldSun?.damageBonus??abilityModifier(c.abilities.dexterity),damageExpression:oldSun&&oldSun.damageExpression!==`1d${martialDie(prior.identity.level)}`?oldSun.damageExpression:`1d${die}`,damageType:"radiant",weaponType:"ranged spell",properties:"Ataque de conjuro a distancia; no es arma de monje",description:"Reemplaza ataques de la acción Atacar. Tras usar un rayo en esa acción: 1 ki y acción adicional para dos rayos más."});}
}
export async function createGuidedMartial(id:string,operationId:string,input:FighterCreationInput,createdAt:string,initialLevels:FighterLevelChoiceInput[]=[]) {
  const creation=validateMartialCreation(input),s=validateMartialBuild({schemaVersion:1,packageVersion:1,ruleset:"dnd5e-2014",classKey:creation.classKey,creationOperationId:operationId,creation,levels:[]});let c=await applyMartialBenefits(await createBuilderCharacter(id,s,createdAt));
  if(initialLevels.length!==creation.startingLevel-1) throw new Error("Completá todos los niveles iniciales.");for(const step of initialLevels) c=await advanceGuidedMartial(c,step,createdAt);return finishBuilderCreation(c);
}
export async function advanceGuidedMartial(input:CharacterV2,choiceInput:FighterLevelChoiceInput,updatedAt:string) {
  const c=CharacterV2Schema.parse(input),choice=FighterLevelChoiceSchema.parse(choiceInput);if(!c.builder || !["monk","paladin"].includes(c.builder.classKey)) throw new Error("Falta historial guiado de Monje/Paladín.");
  const previous=validateMartialBuild(c.builder),old=previous.levels.find((s)=>s.operationId===choice.operationId);if(old) {if(canonicalJsonStringify(old as unknown as JsonValue)!==canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("La operación ya se confirmó con otras elecciones.");return c;}
  const scores=fighterBuilderScores(previous),monk=previous.classKey==="monk",subclass=monk?MONK_TRADITIONS[monkTradition(previous)!]??"":PALADIN_OATHS[paladinOath(previous)!]??"";
  if(choice.operationId===previous.creationOperationId || c.identity.level!==previous.levels.length+1 || choice.level!==c.identity.level+1 || c.identity.className!==(monk?"Monje":"Paladín") || c.identity.subclass!==subclass || BUILDER_ABILITIES.some((k)=>c.abilities[k]!==scores[k])) throw new Error("La ficha cambió fuera del tutorial o no coincide con su historial.");
  const next=validateMartialBuild({...previous,levels:[...previous.levels,choice]}),abilities=fighterBuilderScores(next),maximum=c.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions=c.actions.map((a)=>a.ability?{...a,damageBonus:a.damageExpression?a.damageBonus+abilityModifier(abilities[a.ability])-abilityModifier(scores[a.ability]):a.damageBonus}:a);
  let result=CharacterV2Schema.parse({...c,builder:next,abilities,actions,revision:c.revision+1,metadata:{...c.metadata,updatedAt},identity:{...c.identity,level:choice.level},combat:{...c.combat,hitPoints:{...c.combat.hitPoints,maximum,current:Math.min(c.combat.hitPoints.current,maximum)},hitDice:{...c.combat.hitDice,maximum:choice.level,remaining:c.combat.hitDice.remaining+1,current:String(c.combat.hitDice.remaining+1),formula:`${choice.level}d${monk?8:10}`}}});
  result=await applyAdditionalFighterBenefits(result,c);result=await applyMartialBenefits(result,c);result.combat.armorClass=projectInventory(result).calculatedArmorClass;result.combat.speed=projectUpdatedBuilderSpeed(c,result);return CharacterV2Schema.parse(result);
}
