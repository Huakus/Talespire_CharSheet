import type { CharacterBuilderState,FighterCreation,FighterLevelChoice } from "../domain/character/character-builder-model";
import { RogueChoicesSchema } from "../domain/character/rogue-model";
import { ROGUE_ARCHETYPES,ROGUE_CORE,ROGUE_FEATURES,THIEVES_EXPERTISE,THIEVES_TOOLS,rogueArchetype } from "../domain/character/rogue-catalog";
import { replayRogueChoices,rogueKnownTools,rogueSpellAllowed } from "../domain/character/rogue-builder";
import { SKILL_DEFINITIONS } from "../domain/character/character-checks";
import { PHB_SPELLS,classSpells } from "../domain/character/phb-spells";
import { EK_PROGRESSION } from "../domain/character/phb-fighter-choices";
import { TOOLS,LANGUAGES,GAMES,BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
import { PHB_EQUIPMENT } from "../domain/character/fighter-builder-catalog";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const select = (name: string,label: string,entries: Record<string,string>,value: string) => `<label>${html(label)}<select name="${name}">${Object.entries(entries).map(([key,text]) => `<option value="${html(key)}" ${key === value ? "selected" : ""}>${html(text)}</option>`).join("")}</select></label>`;
const picks = (values: string[]) => ({ "": "Elegí una opción",...Object.fromEntries(values.map((k) => [k,k])) });
const spells = (name: string,label: string,keys: string[],value: string) => select(name,label,{ "": "Elegí un conjuro",...Object.fromEntries(keys.map((k) => [k,PHB_SPELLS[k]!.name])) },value);
function expertiseFields(picks: string[]) {
  return `<fieldset><legend>Experto · elegí dos pericias</legend><p>Duplican tu bonificador de competencia. Requieren competencia previa y no se acumulan con otra pericia. Podés elegir herramientas de ladrón en lugar de una habilidad.</p><div class="builder-grid">${[0,1].map((i) => select(`rogueExpertise${i}`,`Pericia ${i+1}`,{ "": "Elegí una competencia",...Object.fromEntries(Object.entries(SKILL_DEFINITIONS).map(([k,v]) => [k,v.label])),[THIEVES_EXPERTISE]: THIEVES_TOOLS },picks[i] ?? "")).join("")}</div></fieldset>`;
}
export function rogueInitialFields(c: FighterCreation) {
  return expertiseFields(c.rogue.expertise)+`<p>Pícaro concede competencia con herramientas de ladrón y Jerga de Ladrones. Si tu trasfondo repite las herramientas, personalizá esa competencia con otra herramienta. El arquetipo se elige en nivel 3.</p>`;
}
export function rogueEquipmentFields(c: FighterCreation) {
  return `<h3>Prepará tu equipo de pícaro</h3>${select("equipmentMethod","Método de equipo",{ packages: "Paquetes de clase y trasfondo",gold: "4d4 × 10 po y compras" },c.equipment.method)}<div class="builder-grid">${select("rogueWeapon","Arma principal",{ rapier: "Estoque",shortsword: "Espada corta" },c.rogueWeapon)}${select("rogueSecondary","Arma adicional",{ shortbow: "Arco corto, carcaj y 20 flechas",shortsword: "Espada corta" },c.rogueSecondary)}${select("roguePack","Paquete",{ burglar: "Ladrón",dungeoneer: "Explorador de mazmorras",explorer: "Explorador" },c.roguePack)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((choice,i) => select(`backgroundEquipment${i}`,choice.label,Object.fromEntries(choice.keys.map((key) => [key,PHB_EQUIPMENT[key]?.name ?? "Mula y carro"])),c.background.selections[i] ?? choice.keys[0]!)).join("")}</div><p>Se añaden armadura de cuero, dos dagas, herramientas de ladrón y el equipo/dinero del trasfondo. El arquetipo no entrega equipo adicional. El Bribón Arcano necesita conseguir los componentes de sus conjuros.</p>`;
}
export function readRogueInitial(data: FormData,c: FighterCreation) {
  const text = (n: string) => String(data.get(n) ?? "");
  if (data.has("rogueExpertise0")) c.rogue.expertise = [text("rogueExpertise0"),text("rogueExpertise1")];
  if (data.has("rogueWeapon")) { c.rogueWeapon = text("rogueWeapon") as FighterCreation["rogueWeapon"]; c.rogueSecondary = text("rogueSecondary") as FighterCreation["rogueSecondary"]; c.roguePack = text("roguePack") as FighterCreation["roguePack"]; }
}
export function rogueLevelFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const level = choice.level, replay = replayRogueChoices(state), archetype = level === 3 ? choice.rogue.archetype : rogueArchetype(state);
  let content = `<fieldset><legend>Pícaro ${level}${archetype ? ` · ${ROGUE_ARCHETYPES[archetype]}` : ""}</legend><p>Ataque Furtivo: ${Math.ceil(level/2)}d6.</p>${level === 3 ? select("rogueArchetype","Arquetipo de pícaro",{ "": "Elegí un arquetipo",...ROGUE_ARCHETYPES },choice.rogue.archetype ?? "") : ""}${level === 6 ? expertiseFields(choice.rogue.expertise) : ""}${[...ROGUE_CORE,...(archetype ? ROGUE_FEATURES[archetype] : [])].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("")}`;
  if (level === 3 && (archetype === "assassin" || archetype === "mastermind")) {
    const known = rogueKnownTools(state), fixed = archetype === "assassin" ? ["Kit de disfraz","Kit de venenos"] : ["Kit de disfraz","Kit de falsificación"];
    content += `<div class="builder-grid">${fixed.map((tool,i) => select(`rogueTool${i}`,known.includes(tool) ? `Reemplazo de ${tool} (ya competente)` : `Competencia: ${tool}`,picks(known.includes(tool) ? TOOLS.filter((t) => !known.includes(t)) : [tool]),choice.rogue.tools[i] ?? "")).join("")}${archetype === "mastermind" ? select("rogueTool2","Competencia con un juego",picks(GAMES.some((g) => known.includes(g)) ? TOOLS.filter((t) => !known.includes(t)) : GAMES),choice.rogue.tools[2] ?? "")+[0,1].map((i) => select(`rogueLanguage${i}`,`Nuevo idioma ${i+1}`,picks(LANGUAGES),choice.rogue.languages[i] ?? "")).join("") : ""}</div>`;
  }
  if (archetype === "arcane-trickster") {
    const table = EK_PROGRESSION[level]!, before = EK_PROGRESSION[level-1], quota = table.known-(before?.known ?? 0), count = level === 3 ? 2 : level === 10 ? 1 : 0, max = table.slots.filter(Boolean).length;
    const eligible = (free: boolean) => classSpells("wizard",1,max).filter((k) => rogueSpellAllowed(k,max,free) && !replay.spells.some((s) => s.key === k));
    const oldSpell = replay.spells.find((s) => s.key === choice.rogue.replace?.oldKey);
    content += `<fieldset><legend>Bribón Arcano · Inteligencia</legend><p>${table.known} conjuros conocidos, ${table.cantrips+1} trucos (incluye Mano de mago). Espacios: ${table.slots.map((n,i) => `${n} de nivel ${i+1}`).join(" · ")}. Sin preparación diaria, libro, foco arcano ni rituales de clase.</p>${level === 3 ? "<p>Mano de mago se concede automáticamente.</p>" : ""}<div class="builder-grid">${Array.from({ length: count },(_,i) => spells(`rogueCantrip${i}`,`Truco nuevo ${i+1}`,classSpells("wizard",0).filter((k) => k !== "mage-hand" && !replay.cantrips.includes(k)),choice.rogue.cantrips[i] ?? "")).join("")}${Array.from({ length: quota },(_,i) => {
      const free = [3,8,14,20].includes(level) && i === quota-1;
      return spells(`rogueLearn${i}`,`Conjuro nuevo ${i+1} · ${free ? "cualquier escuela" : "Encantamiento/Ilusión"}`,eligible(free),choice.rogue.learn[i]?.key ?? "");
    }).join("")}${level > 3 ? select("rogueOld","Sustituir un conocido (opcional)",{ "": "Conservar todos",...Object.fromEntries(replay.spells.map((s) => [s.key,`${PHB_SPELLS[s.key]!.name}${s.unrestricted ? " · cualquier escuela" : ""}`])) },choice.rogue.replace?.oldKey ?? "") : ""}${oldSpell ? spells("rogueNew",`Sustituto · ${oldSpell.unrestricted ? "cualquier escuela" : "Encantamiento/Ilusión"}`,eligible(oldSpell.unrestricted),choice.rogue.replace?.newKey ?? "") : ""}</div><p>La excepción de escuela de las elecciones de niveles 3, 8, 14 y 20 permanece al sustituir ese conjuro. Los trucos no se sustituyen en estas reglas.</p></fieldset>`;
  }
  return content+"</fieldset>";
}
export function readRogueLevel(data: FormData,choice: FighterLevelChoice) {
  const text = (n: string) => String(data.get(n) ?? "");
  if (data.has("rogueArchetype") && text("rogueArchetype") !== choice.rogue.archetype) {
    choice.rogue = RogueChoicesSchema.parse({ archetype: text("rogueArchetype") || null });
    return choice;
  }
  if (data.has("rogueExpertise0")) choice.rogue.expertise = [text("rogueExpertise0"),text("rogueExpertise1")];
  if (data.has("rogueTool0")) choice.rogue.tools = [0,1,2].filter((i) => data.has(`rogueTool${i}`)).map((i) => text(`rogueTool${i}`));
  if (data.has("rogueLanguage0")) choice.rogue.languages = [text("rogueLanguage0"),text("rogueLanguage1")];
  if (data.has("rogueCantrip0")) choice.rogue.cantrips = [0,1].filter((i) => data.has(`rogueCantrip${i}`)).map((i) => text(`rogueCantrip${i}`));
  if (data.has("rogueLearn0")) {
    const fields = [0,1,2].filter((i) => data.has(`rogueLearn${i}`));
    choice.rogue.learn = fields.map((i) => ({ key: text(`rogueLearn${i}`),unrestricted: [3,8,14,20].includes(choice.level) && i === fields.length-1 }));
  }
  if (data.has("rogueOld")) choice.rogue.replace = text("rogueOld") ? { oldKey: text("rogueOld"),newKey: text("rogueNew") } : null;
  return choice;
}
