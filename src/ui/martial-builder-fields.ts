import type { CharacterBuilderState,FighterCreation,FighterLevelChoice } from "../domain/character/character-builder-model";
import { MONK_TRADITIONS,PALADIN_OATHS,ELEMENTAL_DISCIPLINES,kenseiEligible,monkTradition,martialDefinitions,monkWeaponKeys,PALADIN_SLOTS,OATH_SPELLS } from "../domain/character/martial-catalog";
import { replayMartialChoices } from "../domain/character/martial-builder";
import { ARTISAN_TOOLS,INSTRUMENTS,BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
import { BUILDER_WEAPONS,PHB_EQUIPMENT,FIGHTING_STYLES } from "../domain/character/fighter-builder-catalog";
import { PHB_SPELLS } from "../domain/character/phb-spells";
const html=(s:string)=>s.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const select=(name:string,label:string,entries:Record<string,string>,value:string|null)=>`<label>${html(label)}<select name="${name}">${Object.entries(entries).map(([k,v])=>`<option value="${html(k)}" ${k===value?"selected":""}>${html(v)}</option>`).join("")}</select></label>`;
const weaponOptions=(check:(key:string)=>boolean)=>Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([k])=>check(k)).map(([k,w])=>[k,w.name]));
export function martialInitialFields(c:FighterCreation) {
  return c.classKey==="monk"?`<fieldset><legend>Entrenamiento monástico</legend>${select("monkTool","Herramienta de artesano o instrumento",Object.fromEntries([...ARTISAN_TOOLS,...INSTRUMENTS].map((s)=>[s,s])),c.monk.tool)}<p>Tradición en nivel 3. Defensa sin Armadura usa DES + SAB y Artes Marciales requiere no llevar armadura ni escudo.</p></fieldset>`:`<p>Paladín: Sentido Divino e Imposición de Manos desde nivel 1. Estilo y preparación de conjuros en nivel 2; juramento en nivel 3.</p>`;
}
export function martialEquipmentFields(c:FighterCreation) {
  const monk=c.classKey==="monk",martial=weaponOptions((k)=>BUILDER_WEAPONS[k]!.weapon!.category.startsWith("martial"));
  return `<h3>Equipo de ${monk?"Monje":"Paladín"}</h3>${select("equipmentMethod","Método de equipo",{packages:"Paquetes de clase y trasfondo",gold:monk?"5d4 po y compras (sin multiplicar por 10)":"5d4 × 10 po y compras"},c.equipment.method)}<div class="builder-grid">${monk?select("monkWeapon","Arma principal",weaponOptions((k)=>k==="shortsword"||BUILDER_WEAPONS[k]!.weapon!.category.startsWith("simple")),c.monkWeapon)+select("monkPack","Paquete",{dungeoneer:"Dungeon",explorer:"Explorador"},c.monkPack):select("paladinPrimary","Arma marcial",martial,c.equipment.primary)+select("paladinHands","Escudo o segunda arma",{shield:"Escudo",weapons:"Segunda arma marcial"},c.equipment.shield?"shield":"weapons")+(!c.equipment.shield?select("paladinOtherWeapon","Segunda arma marcial",martial,c.equipment.secondary??"longsword"):"")+select("paladinSecondary","Arma adicional",{javelins:"Cinco jabalinas",...weaponOptions((k)=>BUILDER_WEAPONS[k]!.weapon!.category.startsWith("simple")&&BUILDER_WEAPONS[k]!.weapon!.range==="melee")},c.paladinSecondary)+select("paladinPack","Paquete",{priest:"Sacerdote",explorer:"Explorador"},c.paladinPack)+select("paladinSymbol","Símbolo sagrado",{amulet:"Amuleto",emblem:"Emblema",reliquary:"Relicario"},c.paladinSymbol)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((d,i)=>select(`backgroundEquipment${i}`,d.label,Object.fromEntries(d.keys.map((k)=>[k,PHB_EQUIPMENT[k]?.name??"Mula y carro"])),c.background.selections[i]??d.keys[0]!)).join("")}</div><p>${monk?"Se añaden diez dardos; no se otorgan herramientas físicas ni armadura por la competencia elegida.":"Se añaden cota de malla y símbolo sagrado. El escudo se guarda si el arma necesita ambas manos."} Más equipo y oro del trasfondo.</p>`;
}
export function readMartialInitial(data:FormData,c:FighterCreation) {
  const text=(k:string)=>String(data.get(k)??"");
  if(data.has("monkTool"))c.monk.tool=text("monkTool");
  if(data.has("monkWeapon")){c.monkWeapon=text("monkWeapon");c.monkPack=text("monkPack") as FighterCreation["monkPack"];}
  if(data.has("paladinPrimary")){c.equipment.primary=text("paladinPrimary");c.equipment.shield=text("paladinHands")==="shield";c.equipment.secondary=c.equipment.shield?null:text("paladinOtherWeapon")||"longsword";c.paladinSecondary=text("paladinSecondary");c.paladinPack=text("paladinPack") as FighterCreation["paladinPack"];c.paladinSymbol=text("paladinSymbol") as FighterCreation["paladinSymbol"];}
}
export function martialLevelFields(s:CharacterBuilderState,choice:FighterLevelChoice) {
  const level=choice.level,monk=s.classKey==="monk";let result="";
  if(monk){
    const p=choice.monk,tradition=level===3?p.tradition:monkTradition(s),milestone=[3,6,11,17].includes(level);
    if(level===3)result+=select("monkTradition","Tradición monástica",{"":"Elegí una tradición",...MONK_TRADITIONS},p.tradition);
    if(tradition==="kensei"&&milestone){const known=monkWeaponKeys(s);for(let i=0;i<(level===3?2:1);i++)result+=select(`monkKensei${i}`,level===3?(i?"Arma kensei a distancia":"Arma kensei cuerpo a cuerpo"):"Nueva arma kensei",{"":"Elegí un arma",...weaponOptions((k)=>kenseiEligible(k)&&!known.includes(k)&&!p.weapons.some((v,j)=>j!==i&&v===k)&&(level!==3||BUILDER_WEAPONS[k]!.weapon!.range===(i?"ranged":"melee")))},p.weapons[i]??"");if(level===3)result+=select("monkBrush","Camino del Pincel",{"":"Elegí herramientas",calligrapher:"Suministros de calígrafo",painter:"Suministros de pintor"},p.brush);}
    if(tradition==="four-elements"&&milestone){
      const known=level===3?["attunement"]:replayMartialChoices(s).disciplines,eligible=Object.entries(ELEMENTAL_DISCIPLINES).filter(([k,d])=>d.level<=level&&!known.includes(k));
      if(level>3)result+=select("monkOldDiscipline","Sustituir una disciplina anterior (opcional)",{"":"Conservar todas",...Object.fromEntries(known.map((k)=>[k,ELEMENTAL_DISCIPLINES[k]!.name]))},p.replacement?.oldKey??"");
      if(level>3&&p.replacement?.oldKey)result+=select("monkReplacement","Disciplina sustituta",{"":"Elegí disciplina",...Object.fromEntries(eligible.filter(([k])=>!p.disciplines.includes(k)).map(([k,d])=>[k,`${d.name} · ${d.cost} ki`]))},p.replacement.newKey);
      result+=select("monkDiscipline","Nueva disciplina",{"":"Elegí disciplina",...Object.fromEntries(eligible.filter(([k])=>k!==p.replacement?.newKey).map(([k,d])=>[k,`${d.name} · ${d.cost} ki`]))},p.disciplines[0]??"");
    }
  }else{
    if(level===2)result+=select("paladinStyle","Estilo de combate",{"":"Elegí estilo",...Object.fromEntries(["defense","dueling","great-weapon","protection"].map((k)=>[k,FIGHTING_STYLES[k as keyof typeof FIGHTING_STYLES].name]))},choice.paladin.style);
    if(level===3)result+=select("paladinOath","Juramento sagrado",{"":"Elegí juramento",...PALADIN_OATHS},choice.paladin.oath);
    result+=`<p>Espacios: ${PALADIN_SLOTS[level]!.map((n,i)=>`${n} de nivel ${i+1}`).join(" · ")}. Prepará conjuros en la ficha tras descanso largo. No otorga trucos ni rituales.</p>`;
    const oath=choice.paladin.oath??s.levels.find((p)=>p.paladin.oath)?.paladin.oath;
    if(oath&&[3,5,9,13,17].includes(level))result+=`<p>Siempre preparados: ${OATH_SPELLS[oath][[3,5,9,13,17].indexOf(level)]!.map((k)=>html(PHB_SPELLS[k]?.name??k)).join(" · ")}.</p>`;
  }
  const next={...s,levels:[...s.levels,choice]};result+=martialDefinitions(next).filter((d)=>d.level===level).map((d)=>`<h4>${html(d.name)}</h4><p>${html(d.description)}</p>`).join("");return `<fieldset><legend>${monk?"Monje":"Paladín"} ${level}</legend>${result}</fieldset>`;
}
export function readMartialLevel(data:FormData,c:FighterLevelChoice) {
  const text=(k:string)=>String(data.get(k)??"");
  if(data.has("monkTradition")){const t=(text("monkTradition")||null) as typeof c.monk.tradition;if(t!==c.monk.tradition){c.monk.weapons=[];c.monk.brush=null;c.monk.disciplines=[];c.monk.replacement=null;c.monk.tradition=t;return c;}c.monk.tradition=t;}
  if(data.has("monkKensei0"))c.monk.weapons=[0,1].filter((i)=>data.has(`monkKensei${i}`)).map((i)=>text(`monkKensei${i}`));
  if(data.has("monkBrush"))c.monk.brush=(text("monkBrush")||null) as typeof c.monk.brush;
  if(data.has("monkDiscipline"))c.monk.disciplines=[text("monkDiscipline")];
  if(data.has("monkOldDiscipline"))c.monk.replacement=text("monkOldDiscipline")?{oldKey:text("monkOldDiscipline"),newKey:text("monkReplacement")}:null;
  if(data.has("paladinStyle"))c.paladin.style=(text("paladinStyle")||null) as typeof c.paladin.style;
  if(data.has("paladinOath"))c.paladin.oath=(text("paladinOath")||null) as typeof c.paladin.oath;return c;
}
