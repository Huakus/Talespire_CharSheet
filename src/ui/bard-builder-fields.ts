import type { CharacterBuilderState,FighterCreation,FighterLevelChoice } from "../domain/character/character-builder-model";
import { BARD_COLLEGES,BARD_FEATURES,bardCollege,bardCantrips,bardLearnCount,bardSecretsCount,BARD_KNOWN } from "../domain/character/bard-catalog";
import { replayBardChoices,bardMaxSpellLevel,bardSecretOptions } from "../domain/character/bard-builder";
import { PHB_SPELLS,classSpells } from "../domain/character/phb-spells";
import { SKILL_DEFINITIONS } from "../domain/character/character-checks";
import { INSTRUMENTS,INSTRUMENT_GEAR,BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
import { BUILDER_WEAPONS,PHB_EQUIPMENT } from "../domain/character/fighter-builder-catalog";
import { BardChoicesSchema } from "../domain/character/bard-model";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const select = (name: string,label: string,values: Record<string,string>,value = "") => `<label>${html(label)}<select name="${name}"><option value="">Elegí una opción</option>${Object.entries(values).map(([key,text]) => `<option value="${html(key)}" ${key === value ? "selected" : ""}>${html(text)}</option>`).join("")}</select></label>`;
const spells = (keys: string[]) => Object.fromEntries(keys.map((key) => [key,`${PHB_SPELLS[key]!.name} · N${PHB_SPELLS[key]!.level}`]));
const skillNames = Object.fromEntries(Object.entries(SKILL_DEFINITIONS).map(([key,d]) => [key,d.label]));
const descriptions = (keys: string[]) => [...new Set(keys)].filter((key) => PHB_SPELLS[key]).map((key) => { const s = PHB_SPELLS[key]!; return `<details><summary>${html(s.name)}</summary><p>${html(s.castingTime)} · ${html(s.range)} · ${html(s.components)} · ${html(s.duration)}${s.ritual ? " · Ritual" : ""}${s.concentration ? " · Concentración" : ""}</p><p>${html(s.description)}</p>${s.material ? `<p>Material: ${html(s.material)}</p>` : ""}<p>${html(s.higherLevels)}</p></details>`; }).join("");
export function bardInitialFields(c: FighterCreation) {
  return `<fieldset><legend>Instrumentos y magia de Bardo · Carisma</legend><p>Tres instrumentos distintos, dos trucos y cuatro conjuros de nivel 1. No necesitás preparación diaria. Los rituales deben ser conocidos. Las competencias de trasfondo se pueden personalizar para evitar repeticiones.</p><div class="builder-grid">${[0,1,2].map((i) => select(`bardInstrument${i}`,`Competencia en instrumento ${i+1}`,Object.fromEntries(INSTRUMENTS.map((s) => [s,s])),c.bard.instruments[i])).join("")}${[0,1].map((i) => select(`bardCantrip${i}`,`Truco ${i+1}`,spells(classSpells("bard",0)),c.bard.cantrips[i])).join("")}${[0,1,2,3].map((i) => select(`bardLearn${i}`,`Conjuro conocido ${i+1}`,spells(classSpells("bard",1)),c.bard.learn[i])).join("")}</div>${descriptions([...c.bard.cantrips,...c.bard.learn])}</fieldset>`;
}
export function bardEquipmentFields(c: FighterCreation) {
  const weapons = Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([key,d]) => ["rapier","longsword"].includes(key) || d.weapon?.category.startsWith("simple")).map(([key,d]) => [key,d.name]));
  return `<h3>Prepará tu equipo de Bardo</h3>${select("equipmentMethod","Método",{ packages: "Paquetes de clase y trasfondo",gold: "5d4 × 10 po y compras" },c.equipment.method)}<div class="builder-grid">${select("bardWeapon","Estoque, espada larga o arma sencilla",weapons,c.bardWeapon)}${select("bardPack","Paquete",{ diplomat: "Diplomático",entertainer: "Actor" },c.bardPack)}${select("bardEquipmentInstrument","Instrumento musical (también sirve como foco)",INSTRUMENT_GEAR,c.bardInstrument)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((d,i) => select(`backgroundEquipment${i}`,d.label,Object.fromEntries(d.keys.map((key) => [key,PHB_EQUIPMENT[key]?.name ?? "Mula y carro"])),c.background.selections[i] ?? d.keys[0])).join("")}</div><p>Además: armadura de cuero, una daga y equipo/dinero del trasfondo. Elegir un instrumento como objeto no concede competencia automáticamente.</p>`;
}
export function readBardInitial(data: FormData,c: FighterCreation) {
  const text = (n: string) => String(data.get(n) ?? "");
  if (data.has("bardInstrument0")) c.bard.instruments = [0,1,2].map((i) => text(`bardInstrument${i}`));
  if (data.has("bardCantrip0")) c.bard.cantrips = [0,1].map((i) => text(`bardCantrip${i}`));
  if (data.has("bardLearn0")) c.bard.learn = [0,1,2,3].map((i) => text(`bardLearn${i}`));
  if (data.has("bardWeapon")) { c.bardWeapon = text("bardWeapon"); c.bardPack = text("bardPack") as typeof c.bardPack; c.bardInstrument = text("bardEquipmentInstrument"); }
}
export function bardLevelFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const replay = replayBardChoices(state),level = choice.level,c = choice.bard,college = c.college ?? bardCollege(state),known = [...replay.cantrips,...replay.spells.map((s) => s.key)];
  const eligible = classSpells("bard",1,bardMaxSpellLevel(level)).filter((key) => !known.includes(key));
  let result = level === 3 ? `<fieldset><legend>Colegio de Bardo</legend>${select("bardCollege","Colegio",BARD_COLLEGES,c.college ?? "")}<p>Conocimiento y Valor: Manual 2014. Glamour, Espadas y Susurros: Xanathar.</p></fieldset>` : "";
  if (level === 3 && college === "lore") result += `<fieldset><legend>Competencias Adicionales</legend>${[0,1,2].map((i) => select(`bardSkill${i}`,`Habilidad nueva ${i+1}`,skillNames,c.skills[i])).join("")}</fieldset>`;
  if (level === 3 && college === "swords") result += select("bardStyle","Estilo de Combate",{ dueling: "Duelo", "two-weapon": "Lucha con dos armas" },c.style ?? "");
  if ([3,10].includes(level)) result += `<fieldset><legend>Experto · dos habilidades competentes</legend>${[0,1].map((i) => select(`bardExpertise${i}`,`Pericia ${i+1}`,skillNames,c.expertise[i])).join("")}</fieldset>`;
  result += `<fieldset><legend>Conjuros conocidos · Carisma</legend><p>${BARD_KNOWN[level]} plazas conocidas (incluyen Secretos Mágicos de 10/14/18), ${bardCantrips(level)} trucos ordinarios${college === "lore" && level >= 6 ? " y dos Secretos adicionales del Conocimiento" : ""}. Máximo nivel de conjuro ${bardMaxSpellLevel(level)}. Podés sustituir un conocido anterior por un conjuro de la lista de Bardo; no cambia el total.</p><div class="builder-grid">${Array.from({ length: bardCantrips(level)-bardCantrips(level-1) },(_,i) => select(`bardCantrip${i}`,`Truco adicional ${i+1}`,spells(classSpells("bard",0).filter((key) => !known.includes(key))),c.cantrips[i])).join("")}${Array.from({ length: bardLearnCount(level) },(_,i) => select(`bardLearn${i}`,`Conjuro nuevo ${i+1}`,spells(eligible),c.learn[i])).join("")}${select("bardSpellOld","Sustituir un conocido (opcional)",spells(replay.spells.map((s) => s.key)),c.replaceSpell?.oldKey)}${c.replaceSpell ? select("bardSpellNew","Conjuro sustituto de la lista de Bardo",spells(eligible),c.replaceSpell.newKey) : ""}</div></fieldset>`;
  if (bardSecretsCount(level,college)) result += `<fieldset><legend>${level === 6 ? "Secretos Mágicos Adicionales · fuera del total de la tabla" : "Secretos Mágicos · incluidos en el total de la tabla"}</legend><p>Dos conjuros de cualquier clase, incluso trucos, hasta nivel ${bardMaxSpellLevel(level)}. Se lanzan con Carisma como conjuros de Bardo.</p>${[0,1].map((i) => select(`bardSecret${i}`,`Secreto Mágico ${i+1}`,spells(bardSecretOptions(level).filter((key) => !known.includes(key))),c.secrets[i])).join("")}</fieldset>`;
  result += (college ? BARD_FEATURES[college].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("") : "");
  return result+descriptions([...c.cantrips,...c.learn,...c.secrets,c.replaceSpell?.newKey ?? ""]);
}
export function readBardLevel(data: FormData,choice: FighterLevelChoice) {
  const text = (n: string) => String(data.get(n) ?? ""),c = { ...choice.bard };
  if (data.has("bardCollege") && c.college !== text("bardCollege")) { choice.bard = BardChoicesSchema.parse({ college: text("bardCollege") || null,cantrips: c.cantrips,learn: c.learn,replaceSpell: c.replaceSpell }); return choice; }
  for (const [prefix,key] of [["bardSkill","skills"],["bardExpertise","expertise"],["bardCantrip","cantrips"],["bardLearn","learn"],["bardSecret","secrets"]] as const) if (data.has(`${prefix}0`)) c[key] = [0,1,2,3].filter((i) => data.has(`${prefix}${i}`)).map((i) => text(`${prefix}${i}`));
  if (data.has("bardStyle")) c.style = (text("bardStyle") || null) as typeof c.style;
  if (data.has("bardSpellOld")) c.replaceSpell = text("bardSpellOld") ? { oldKey: text("bardSpellOld"),newKey: text("bardSpellNew") } : null;
  return { ...choice,bard: c };
}
