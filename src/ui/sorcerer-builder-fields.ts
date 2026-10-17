import type { CharacterBuilderState,FighterCreation,FighterLevelChoice } from "../domain/character/character-builder-model";
import { SORCERER_ORIGINS,SORCERER_AFFINITIES,DIVINE_SPELLS,METAMAGIC,SORCERER_KNOWN,sorcererCantrips,sorcererSpellList,sorcererOrigin,SORCERER_FEATURES } from "../domain/character/sorcerer-catalog";
import { replaySorcererChoices,sorcererMaxSpellLevel } from "../domain/character/sorcerer-builder";
import { DRAGON_ANCESTRIES,BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
import { BUILDER_WEAPONS,PHB_EQUIPMENT } from "../domain/character/fighter-builder-catalog";
import { PHB_SPELLS,classSpells } from "../domain/character/phb-spells";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const select = (name: string,label: string,values: Record<string,string>,value = "") => `<label>${html(label)}<select name="${name}"><option value="">Elegí una opción</option>${Object.entries(values).map(([key,text]) => `<option value="${html(key)}" ${value === key ? "selected" : ""}>${html(text)}</option>`).join("")}</select></label>`;
const picks = (keys: string[]) => Object.fromEntries(keys.map((key) => [key,`${PHB_SPELLS[key]!.name} · N${PHB_SPELLS[key]!.level}`]));
const skeleton = (c: FighterCreation): CharacterBuilderState => ({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "sorcerer",creationOperationId: "build_00000000000000000000000000000000",creation: c,levels: [] });
export function sorcererIdentityFields(c: FighterCreation) { return `<fieldset><legend>Origen de Hechicero</legend>${select("sorcererOrigin","Origen",SORCERER_ORIGINS,c.sorcerer.origin ?? "")}${c.sorcerer.origin === "draconic" ? select("sorcererAncestry","Ancestro dragón (independiente de raza)",Object.fromEntries(Object.entries(DRAGON_ANCESTRIES).map(([k,a]) => [k,a.name])),c.sorcerer.ancestry ?? "") : c.sorcerer.origin === "divine-soul" ? select("sorcererAffinity","Afinidad divina",SORCERER_AFFINITIES,c.sorcerer.affinity ?? "") : ""}</fieldset>`; }
export function sorcererInitialFields(c: FighterCreation) {
  const state = skeleton(c),bonus = c.sorcerer.affinity ? DIVINE_SPELLS[c.sorcerer.affinity] : null;
  return `<fieldset><legend>Conjuros de Hechicero · Carisma</legend><p>Cuatro trucos y dos conocidos. No hay preparación diaria ni rituales de clase. ${bonus ? `Magia Divina agrega ${html(PHB_SPELLS[bonus]!.name)} fuera del cupo; los trucos y conocidos pueden venir de Clérigo.` : ""}</p>${Array.from({ length: 4 },(_,i) => select(`sorcererCantrip${i}`,`Truco ${i+1}`,picks(sorcererSpellList(state,0)),c.sorcerer.cantrips[i])).join("")}${[0,1].map((i) => select(`sorcererLearn${i}`,`Conjuro de nivel 1 ${i+1}`,picks(sorcererSpellList(state,1).filter((s) => s !== bonus)),c.sorcerer.learn[i])).join("")}</fieldset>`;
}
export function sorcererEquipmentFields(c: FighterCreation) {
  const simple = Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([,w]) => w.weapon!.category.startsWith("simple")).map(([k,w]) => [k,w.name]));
  return `<h3>Prepará tu equipo de Hechicero</h3>${select("equipmentMethod","Método",{ packages: "Paquetes de clase y trasfondo",gold: "3d4 × 10 po y compras" },c.equipment.method)}<div class="builder-grid">${select("sorcererWeapon","Ballesta ligera y veinte virotes, o un arma sencilla",simple,c.sorcererWeapon)}${select("wizardFocus","Componentes",{ "component-pouch": "Bolsa de componentes",crystal: "Cristal",orb: "Orbe",rod: "Vara",staff: "Bastón arcano",wand: "Varita" },c.wizardFocus)}${select("sorcererPack","Paquete",{ dungeoneer: "Explorador de mazmorras",explorer: "Explorador" },c.sorcererPack)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((p,i) => select(`backgroundEquipment${i}`,p.label,Object.fromEntries(p.keys.map((k) => [k,PHB_EQUIPMENT[k]?.name ?? "Mula y carro"])),c.background.selections[i] ?? p.keys[0])).join("")}</div><p>Además, dos dagas y equipo/dinero del trasfondo. Elegir un arma en el paquete no concede competencia adicional. El foco no sustituye componentes con precio ni consumidos.</p>`;
}
export function readSorcererInitial(data: FormData,c: FighterCreation) {
  const t = (n: string) => String(data.get(n) ?? "");
  if (data.has("sorcererOrigin")) {
    const origin = (t("sorcererOrigin") || null) as typeof c.sorcerer.origin;
    if (origin !== c.sorcerer.origin) { c.sorcerer.ancestry = origin === "draconic" ? "red" : null;c.sorcerer.affinity = origin === "divine-soul" ? "good" : null; }c.sorcerer.origin = origin;
    if (data.has("sorcererAncestry") && origin === "draconic") c.sorcerer.ancestry = (t("sorcererAncestry") || null) as typeof c.sorcerer.ancestry;
    if (data.has("sorcererAffinity") && origin === "divine-soul") c.sorcerer.affinity = (t("sorcererAffinity") || null) as typeof c.sorcerer.affinity;
  }
  if (data.has("sorcererCantrip0")) c.sorcerer.cantrips = [0,1,2,3].map((i) => t(`sorcererCantrip${i}`));
  if (data.has("sorcererLearn0")) c.sorcerer.learn = [0,1].map((i) => t(`sorcererLearn${i}`));
  if (data.has("sorcererWeapon")) { c.sorcererWeapon = t("sorcererWeapon");c.sorcererPack = t("sorcererPack") as typeof c.sorcererPack;c.wizardFocus = t("wizardFocus") as typeof c.wizardFocus; }
}
export function sorcererLevelFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const level = choice.level,c = choice.sorcerer,replay = replaySorcererChoices(state),max = sorcererMaxSpellLevel(level),bonus = replay.origin === "shadow" && level === 3 ? "darkness" : null,known = replay.spells.map((s) => s.key),eligible = sorcererSpellList(state,1,max).filter((s) => !known.includes(s) && s !== bonus),old = replay.spells.find((s) => s.key === c.replaceSpell?.oldKey);
  let out = `<fieldset><legend>Aprendizaje de Hechicero</legend><p>${sorcererCantrips(level)} trucos y ${SORCERER_KNOWN[level]} conocidos ordinarios. ${bonus ? "Oscuridad se incorpora fuera del cupo por Ojos de la Oscuridad." : ""}</p>${Array.from({ length: sorcererCantrips(level)-sorcererCantrips(level-1) },(_,i) => select(`sorcererCantrip${i}`,`Truco nuevo ${i+1}`,picks(sorcererSpellList(state,0).filter((s) => !replay.cantrips.includes(s))),c.cantrips[i])).join("")}${Array.from({ length: SORCERER_KNOWN[level]!-SORCERER_KNOWN[level-1]! },(_,i) => select(`sorcererLearn${i}`,`Conjuro nuevo ${i+1}`,picks(eligible),c.learn[i])).join("")}${select("sorcererSpellOld","Sustituir un conocido anterior (opcional)",picks(replay.spells.map((s) => s.key)),c.replaceSpell?.oldKey)}${c.replaceSpell ? select("sorcererSpellNew",old?.bonus === "divine" ? "Sustituto adicional: lista de Clérigo" : "Conjuro sustituto",picks((old?.bonus === "divine" ? classSpells("cleric",1,max) : eligible).filter((s) => !known.includes(s) && s !== bonus)),c.replaceSpell.newKey) : ""}</fieldset>`;
  const quota = level === 3 ? 2 : [10,17].includes(level) ? 1 : 0;
  if (quota) out += `<fieldset><legend>Metamagia</legend><p>Elegí ${quota} opciones nuevas. En 2014 no se sustituyen; Potenciado puede combinarse con otra.</p>${Array.from({ length: quota },(_,i) => select(`sorcererMeta${i}`,`Metamagia ${i+1}`,Object.fromEntries(Object.entries(METAMAGIC).map(([k,m]) => [k,m.name])),c.metamagic[i])).join("")}${c.metamagic.filter((k) => METAMAGIC[k]).map((k) => `<p><strong>${html(METAMAGIC[k].name)}</strong>: ${html(METAMAGIC[k].description)}</p>`).join("")}</fieldset>`;
  out += SORCERER_FEATURES[sorcererOrigin(state)!].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("");
  for (const k of [...c.cantrips,...c.learn,c.replaceSpell?.newKey ?? ""]) if (PHB_SPELLS[k]) out += `<details><summary>${html(PHB_SPELLS[k]!.name)}</summary><p>${html(PHB_SPELLS[k]!.description)}</p></details>`;
  return out;
}
export function readSorcererLevel(data: FormData,choice: FighterLevelChoice) {
  const t = (n: string) => String(data.get(n) ?? ""),c = { ...choice.sorcerer };
  if (data.has("sorcererCantrip0")) c.cantrips = [0].map((i) => t(`sorcererCantrip${i}`));
  if (data.has("sorcererLearn0")) c.learn = [0].map((i) => t(`sorcererLearn${i}`));
  if (data.has("sorcererMeta0")) c.metamagic = [0,1].filter((i) => data.has(`sorcererMeta${i}`)).map((i) => t(`sorcererMeta${i}`)) as typeof c.metamagic;
  if (data.has("sorcererSpellOld")) c.replaceSpell = t("sorcererSpellOld") ? { oldKey: t("sorcererSpellOld"),newKey: t("sorcererSpellNew") } : null;
  return { ...choice,sorcerer: c };
}
