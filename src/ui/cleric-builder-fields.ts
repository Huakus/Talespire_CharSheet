import type { CharacterBuilderState, FighterCreation, FighterLevelChoice } from "../domain/character/character-builder-model";
import { CLERIC_DOMAINS, CLERIC_FEATURES, KNOWLEDGE_SKILLS, NATURE_SKILLS, clericCantripCount, clericDomainSpells, clericHeavyArmor, clericMartialWeapons } from "../domain/character/cleric-catalog";
import { PHB_SPELLS, classSpells } from "../domain/character/phb-spells";
import { LANGUAGES, BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
import { BUILDER_WEAPONS, PHB_EQUIPMENT } from "../domain/character/fighter-builder-catalog";
import { SKILL_DEFINITIONS, type SkillKey } from "../domain/character/character-checks";
import { replayClericChoices } from "../domain/character/cleric-builder";
import { WIZARD_SLOTS } from "../domain/character/wizard-catalog";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const select = (name: string,label: string,entries: Record<string,string>,value: string) => `<label>${html(label)}<select name="${name}">${Object.entries(entries).map(([key,text]) => `<option value="${html(key)}" ${key === value ? "selected" : ""}>${html(text)}</option>`).join("")}</select></label>`;
const spells = (name: string,label: string,keys: string[],value: string) => select(name,label,{ "": "Elegí un conjuro",...Object.fromEntries(keys.map((k) => [k,PHB_SPELLS[k]!.name])) },value);
export function clericIdentityFields(c: FighterCreation) {
  return `<fieldset><legend>Fe y dominio divino</legend>${select("clericDomain","Dominio",{ "": "Elegí tu dominio",...CLERIC_DOMAINS },c.cleric.domain ?? "")}<label>Deidad, panteón o filosofía<input name="clericDeity" maxlength="500" value="${html(c.cleric.deity)}"></label><p>El dominio se elige en nivel 1. Acordá con el GM su relación con tu fe y la campaña.</p></fieldset>`;
}
export function clericInitialFields(c: FighterCreation) {
  const domain = c.cleric.domain;
  let content = `<fieldset><legend>Magia y beneficios de dominio</legend><p>Elegí tres trucos permanentes. Los conjuros de nivel 1+ se preparan desde toda la lista después de un descanso largo; los de dominio están siempre preparados sin ocupar cupo.</p><div class="builder-grid">${[0,1,2].map((i) => spells(`clericCantrip${i}`,`Truco ${i+1}`,classSpells("cleric",0).filter((k) => domain !== "light" || k !== "light").filter((k) => domain !== "grave" || k !== "spare-the-dying"),c.cleric.cantrips[i] ?? "")).join("")}</div>`;
  if (domain === "nature" || domain === "knowledge") {
    const skills = domain === "nature" ? NATURE_SKILLS : KNOWLEDGE_SKILLS;
    content += `<div class="builder-grid">${Array.from({ length: domain === "knowledge" ? 2 : 1 },(_,i) => select(`clericSkill${i}`,`Habilidad de dominio ${i+1}`,{ "": "Elegí una habilidad",...Object.fromEntries(skills.map((s) => [s,SKILL_DEFINITIONS[s as SkillKey].label])) },c.cleric.skills[i] ?? "")).join("")}${domain === "nature" ? spells("clericNatureCantrip","Truco de druida (Sabiduría)",classSpells("druid",0),c.cleric.natureCantrip) : [0,1].map((i) => select(`clericLanguage${i}`,`Idioma de Conocimiento ${i+1}`,{ "": "Elegí un idioma",...Object.fromEntries(LANGUAGES.map((l) => [l,l])) },c.cleric.languages[i] ?? "")).join("")}</div>`;
  }
  if (domain) content += `<p>Siempre preparados: ${clericDomainSpells(domain,1).map((k) => html(PHB_SPELLS[k]?.name ?? k)).join(" · ")}.</p>${CLERIC_FEATURES[domain].filter((f) => f.level === 1).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("")}`;
  return content+"</fieldset>";
}
export function readClericInitial(data: FormData,c: FighterCreation) {
  const text = (name: string) => String(data.get(name) ?? "");
  if (data.has("clericDomain")) {
    const domain = (text("clericDomain") || null) as FighterCreation["cleric"]["domain"];
    if (domain !== c.cleric.domain) { c.cleric.skills = []; c.cleric.languages = []; c.cleric.natureCantrip = ""; }
    c.cleric.domain = domain; c.cleric.deity = text("clericDeity");
  }
  if (data.has("clericCantrip0")) c.cleric.cantrips = [0,1,2].map((i) => text(`clericCantrip${i}`));
  if (data.has("clericSkill0")) c.cleric.skills = [0,1].filter((i) => data.has(`clericSkill${i}`)).map((i) => text(`clericSkill${i}`));
  if (data.has("clericLanguage0")) c.cleric.languages = [0,1].map((i) => text(`clericLanguage${i}`));
  if (data.has("clericNatureCantrip")) c.cleric.natureCantrip = text("clericNatureCantrip");
  if (data.has("clericWeapon")) {
    c.clericWeapon = text("clericWeapon") as FighterCreation["clericWeapon"]; c.clericArmor = text("clericArmor") as FighterCreation["clericArmor"]; c.clericSecondary = text("clericSecondary"); c.clericPack = text("clericPack") as FighterCreation["clericPack"]; c.clericSymbol = text("clericSymbol") as FighterCreation["clericSymbol"];
  }
}
export function clericEquipmentFields(c: FighterCreation) {
  const heavy = clericHeavyArmor(c.cleric.domain) || c.initialFeat?.key === "heavily-armored", hammer = clericMartialWeapons(c.cleric.domain) || c.race.includes("dwarf") || c.initialFeat?.key === "weapon-master" && c.initialFeat.weapons.includes("warhammer");
  return `<h3>Prepará tu equipo de clérigo</h3>${select("equipmentMethod","Método de equipo",{ packages: "Paquetes de clase y trasfondo",gold: "5d4 × 10 po y compras" },c.equipment.method)}<div class="builder-grid">${select("clericWeapon","Arma principal",{ mace: "Maza",warhammer: "Martillo de guerra" },c.clericWeapon)}${!hammer ? "<small>Martillo de guerra requiere competencia; se deshabilita en la lista.</small>" : ""}${select("clericArmor","Armadura",{ "scale-mail": "Cota de escamas",leather: "Cuero","chain-mail": "Cota de malla" },c.clericArmor)}${!heavy ? "<small>Cota de malla requiere competencia en armadura pesada.</small>" : ""}${select("clericSecondary","Arma adicional",Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([,i]) => i.weapon!.category.startsWith("simple")).map(([k,i]) => [k,`${i.name}${k === "light-crossbow" ? " y 20 virotes" : ""}`])),c.clericSecondary)}${select("clericPack","Paquete",{ priest: "Sacerdote",explorer: "Explorador" },c.clericPack)}${select("clericSymbol","Símbolo sagrado",{ amulet: "Amuleto",emblem: "Emblema",reliquary: "Relicario" },c.clericSymbol)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((choice,i) => select(`backgroundEquipment${i}`,choice.label,Object.fromEntries(choice.keys.map((key) => [key,PHB_EQUIPMENT[key]?.name ?? "Mula y carro"])),c.background.selections[i] ?? choice.keys[0]!)).join("")}</div><p>Se añaden escudo, símbolo sagrado y el equipo/dinero del trasfondo. El símbolo en escudo puede servir de foco; los componentes con coste y consumidos siguen siendo necesarios.</p>`;
}
export function clericLevelFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const replay = replayClericChoices(state), level = choice.level, count = clericCantripCount(level)-clericCantripCount(level-1);
  return `<fieldset><legend>Clérigo ${level} · ${CLERIC_DOMAINS[replay.domain]}</legend><p>Espacios: ${WIZARD_SLOTS[level]!.map((n,i) => `${n} de nivel ${i+1}`).join(" · ")}. Podrás preparar los nuevos conjuros disponibles después de descansar.</p>${Array.from({ length: count },(_,i) => spells(`clericCantrip${i}`,"Nuevo truco de clérigo",classSpells("cleric",0).filter((k) => !replay.cantrips.includes(k)),choice.cleric.cantrips[i] ?? "")).join("")}${clericDomainSpells(replay.domain,level).length > replay.domainSpells.length ? `<p>Nuevos conjuros de dominio, siempre preparados: ${clericDomainSpells(replay.domain,level).filter((k) => !replay.domainSpells.includes(k)).map((k) => html(PHB_SPELLS[k]!.name)).join(" · ")}.</p>` : ""}${CLERIC_FEATURES[replay.domain].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("")}</fieldset>`;
}
