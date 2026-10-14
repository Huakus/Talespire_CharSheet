import type { CharacterBuilderState,FighterCreation,FighterLevelChoice } from "../domain/character/character-builder-model";
import type { RangerCompanion,RangerEnemy } from "../domain/character/ranger-model";
import { RANGER_ARCHETYPES,RANGER_TERRAINS,RANGER_ENEMIES,RANGER_HUMANOIDS,RANGER_COMPANIONS,RANGER_KNOWN,HUNTER_OPTIONS,RANGER_FEATURES,rangerArchetype,rangerBonusSpell } from "../domain/character/ranger-catalog";
import { replayRangerChoices,rangerMaxSpellLevel } from "../domain/character/ranger-builder";
import { PHB_SPELLS,classSpells } from "../domain/character/phb-spells";
import { BACKGROUND_EQUIPMENT,LANGUAGES } from "../domain/character/phb-character-options";
import { BUILDER_WEAPONS,PHB_EQUIPMENT,FIGHTING_STYLES } from "../domain/character/fighter-builder-catalog";
import { builderFeats } from "../domain/character/fighter-build-rules";
export const rangerHtml = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const html = rangerHtml;
const select = (name: string,label: string,values: Record<string,string>,value = "") => `<label>${html(label)}<select name="${name}"><option value="">Elegí una opción</option>${Object.entries(values).map(([key,text]) => `<option value="${html(key)}" ${key === value ? "selected" : ""}>${html(text)}</option>`).join("")}</select></label>`;
const spells = (keys: string[]) => Object.fromEntries(keys.map((key) => [key,`${PHB_SPELLS[key]!.name} · N${PHB_SPELLS[key]!.level}`]));
function enemyFields(enemy: RangerEnemy|null) {
  return `<fieldset><legend>Enemigo Predilecto</legend>${select("rangerEnemyType","Tipo de enemigo",RANGER_ENEMIES,enemy?.type ?? "")}${enemy?.type === "humanoids" ? `<datalist id="ranger-humanoids">${RANGER_HUMANOIDS.map((s) => `<option value="${html(s)}"></option>`).join("")}</datalist>${[0,1].map((i) => `<label>Raza humanoide ${i+1}<input name="rangerHumanoid${i}" list="ranger-humanoids" maxlength="80" value="${html(enemy.humanoids[i] ?? "")}"></label>`).join("")}<p>Podés escribir otra raza de humanoides presente en la campaña; no una categoría genérica ni repetir las anteriores.</p>` : ""}${enemy ? `${select("rangerEnemyLanguage","Idioma de esos enemigos (vacío si no hay uno nuevo)",{ ...Object.fromEntries(LANGUAGES.map((s) => [s,s])),...Object.fromEntries(["Gnoll","Sahuagin","Aarakocra","Bullywug","Gith"].map((s) => [s,s])),custom: "Otro idioma que hablen (acordado con el GM)" },enemy.language && ![...LANGUAGES,"Gnoll","Sahuagin","Aarakocra","Bullywug","Gith"].includes(enemy.language) ? "custom" : enemy.language)}${enemy.language && ![...LANGUAGES,"Gnoll","Sahuagin","Aarakocra","Bullywug","Gith"].includes(enemy.language) ? `<label>Otro idioma<input name="rangerCustomLanguage" maxlength="80" value="${html(enemy.language === "custom" ? "" : enemy.language)}"></label>` : ""}<label class="checkbox"><input type="checkbox" name="rangerEnemyConfirmed" ${enemy.languageConfirmed ? "checked" : ""}> Confirmo que esos enemigos hablan este idioma; si queda vacío, no hay uno nuevo que pueda aprender.</label>` : ""}</fieldset>`;
}
function readEnemy(data: FormData,old: RangerEnemy|null) {
  const t = (n: string) => String(data.get(n) ?? ""),type = t("rangerEnemyType");if (!type) return null;
  if (type !== old?.type) return { type: type as RangerEnemy["type"],humanoids: [],language: "",languageConfirmed: false };
  const selected = t("rangerEnemyLanguage"),custom = selected === "custom" ? data.has("rangerCustomLanguage") ? t("rangerCustomLanguage") : "custom" : selected;
  return { type: type as RangerEnemy["type"],humanoids: type === "humanoids" ? [t("rangerHumanoid0"),t("rangerHumanoid1")].filter(Boolean) : [],language: custom,languageConfirmed: data.has("rangerEnemyConfirmed") };
}
export function rangerInitialFields(c: FighterCreation) { return `${enemyFields(c.ranger.enemy)}${select("rangerTerrain","Terreno predilecto",RANGER_TERRAINS,c.ranger.terrain ?? "")}<p>Explorador aprende magia y estilo en nivel 2, y arquetipo en 3. No recibe trucos, preparación diaria, rituales ni foco druídico por esta clase en las reglas 2014.</p>`; }
export function readRangerInitial(data: FormData,c: FighterCreation) {
  const t = (n: string) => String(data.get(n) ?? "");if (data.has("rangerEnemyType")) c.ranger.enemy = readEnemy(data,c.ranger.enemy);if (data.has("rangerTerrain")) c.ranger.terrain = (t("rangerTerrain") || null) as typeof c.ranger.terrain;
  if (data.has("rangerArmor")) {
    c.rangerArmor = t("rangerArmor") as typeof c.rangerArmor;c.rangerPack = t("rangerPack") as typeof c.rangerPack;
    if (t("rangerWeaponMode") === "shortswords") c.rangerWeapons = ["shortsword","shortsword"];
    else c.rangerWeapons = data.has("rangerWeapon0") ? [t("rangerWeapon0"),t("rangerWeapon1")] : ["handaxe","handaxe"];
  }
}
export function rangerEquipmentFields(c: FighterCreation) {
  const simple = Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([,w]) => w.weapon!.category.startsWith("simple") && w.weapon!.range === "melee").map(([key,w]) => [key,w.name])),shortswords = c.rangerWeapons.every((k) => k === "shortsword");
  return `<h3>Prepará tu equipo de Explorador</h3>${select("equipmentMethod","Método",{ packages: "Paquetes de clase y trasfondo",gold: "5d4 × 10 po y compras" },c.equipment.method)}<div class="builder-grid">${select("rangerArmor","Armadura",{ "scale-mail": "Cota de escamas",leather: "Cuero" },c.rangerArmor)}${select("rangerWeaponMode","Armas cuerpo a cuerpo",{ shortswords: "Dos espadas cortas",simple: "Dos armas sencillas cuerpo a cuerpo" },shortswords ? "shortswords" : "simple")}${!shortswords ? [0,1].map((i) => select(`rangerWeapon${i}`,`Arma sencilla ${i+1}`,simple,c.rangerWeapons[i])).join("") : ""}${select("rangerPack","Paquete",{ dungeoneer: "Explorador de mazmorras",explorer: "Explorador" },c.rangerPack)}${BACKGROUND_EQUIPMENT[c.background.equipment].choices.map((d,i) => select(`backgroundEquipment${i}`,d.label,Object.fromEntries(d.keys.map((key) => [key,PHB_EQUIPMENT[key]?.name ?? "Mula y carro"])),c.background.selections[i] ?? d.keys[0])).join("")}</div><p>Además arco largo, carcaj con 20 flechas y equipo/dinero del trasfondo. El paquete no incluye escudo ni bolsa de componentes; podés adquirirlos después o usar la alternativa de oro.</p>`;
}
export function companionFields(b: RangerCompanion,prefix = "rangerCompanion") {
  return `<div class="builder-grid"><label>Nombre<input name="${prefix}Name" maxlength="100" value="${html(b.name)}"></label><label>Especie de bestia<input name="${prefix}Species" maxlength="100" value="${html(b.species)}"></label>${select(`${prefix}Size`,"Tamaño",{ tiny: "Diminuto",small: "Pequeño",medium: "Mediano" },b.size)}${select(`${prefix}Cr`,"VD",{ "0": "0","0.125": "1/8","0.25": "1/4" },String(b.challenge))}${[["Hp","PG del bloque",b.baseHp],["Ac","CA del bloque",b.baseAc],["Attack","Ataque del bloque",b.attackBonus],["Dice","Cantidad de Dados de Golpe",b.hitDice]].map(([key,label,value]) => `<label>${label}<input name="${prefix}${key}" type="number" value="${value}"></label>`).join("")}${select(`${prefix}Die`,"Tipo de Dado de Golpe",Object.fromEntries([4,6,8,10,12,20].map((n) => [String(n),`d${n}`])),String(b.dieSize))}<label>Daño de ataque del bloque<input name="${prefix}Damage" maxlength="100" value="${html(b.damage)}"></label><label>Habilidades/salvaciones competentes: nombre=bono, separados por punto y coma<input name="${prefix}Checks" value="${html(b.checks.map((s) => `${s.label}=${s.bonus}`).join("; "))}"></label><label>Rasgos, otros ataques, atributos y movimiento<textarea name="${prefix}Notes" maxlength="6000">${html(b.notes)}</textarea></label></div><p>Ingresá valores del bloque original, sin el bono de Explorador. Se sumará tu competencia a CA, ataques, daño y las competencias listadas; PG máximos = mayor entre PG base y 4 × nivel.</p>`;
}
export function readCompanion(data: FormData,old: RangerCompanion,prefix = "rangerCompanion"): RangerCompanion {
  const t = (s: string) => String(data.get(`${prefix}${s}`) ?? ""),n = (s: string) => Number(t(s));
  return { ...old,name: t("Name"),species: t("Species"),size: t("Size") as RangerCompanion["size"],challenge: n("Cr"),baseHp: n("Hp"),baseAc: n("Ac"),attackBonus: n("Attack"),damage: t("Damage"),hitDice: n("Dice"),dieSize: n("Die") as RangerCompanion["dieSize"],checks: t("Checks").split(";").filter((s) => s.trim()).map((s) => { const [label,bonus] = s.split("=");return { label: label!.trim(),bonus: Number(bonus) }; }),notes: t("Notes") };
}
export function rangerLevelFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const replay = replayRangerChoices(state),level = choice.level,c = choice.ranger,archetype = c.archetype ?? rangerArchetype(state),known = replay.spells.map((s) => s.key),bonus = rangerBonusSpell(archetype,level),eligible = classSpells("ranger",1,rangerMaxSpellLevel(level)).filter((s) => !known.includes(s) && s !== bonus);
  let out = [6,14].includes(level) ? enemyFields(c.enemy) : "";if ([6,10].includes(level)) out += select("rangerTerrain","Terreno adicional",RANGER_TERRAINS,c.terrain ?? "");
  if (level === 2) out += select("rangerStyle","Estilo de Combate",Object.fromEntries(["archery","defense","dueling","two-weapon"].map((s) => [s,FIGHTING_STYLES[s as keyof typeof FIGHTING_STYLES].name])),c.style ?? "");
  if (level === 3) out += select("rangerArchetype","Arquetipo de Explorador",RANGER_ARCHETYPES,c.archetype ?? "");
  if (archetype === "hunter" && HUNTER_OPTIONS[level]) out += `<fieldset><legend>Opción de Cazador ${level}</legend>${select("rangerHunter","Rasgo",Object.fromEntries(Object.entries(HUNTER_OPTIONS[level]!).map(([key,d]) => [key,d.name])),c.hunter)}${c.hunter && HUNTER_OPTIONS[level]![c.hunter] ? `<p>${html(HUNTER_OPTIONS[level]![c.hunter]!.description)}</p>` : ""}</fieldset>`;
  if (archetype === "beast-master" && level === 3) { const profile = c.companion ? Object.keys(RANGER_COMPANIONS).find((key) => RANGER_COMPANIONS[key]!.species === c.companion!.species) ?? "custom" : "";out += `<fieldset><legend>Compañero Animal</legend>${select("rangerCompanionPreset","Referencia inicial",{ ...Object.fromEntries(Object.entries(RANGER_COMPANIONS).map(([key,b]) => [key,b.species])),custom: "Otra bestia Mediana o menor de VD 1/4 o menor" },profile)}${c.companion ? companionFields(c.companion) : ""}</fieldset>`; }
  if (archetype === "gloom-stalker" && level === 7 && builderFeats(state).some(({ feat }) => feat.key === "resilient" && feat.ability === "wisdom")) out += select("rangerIronMind","Ya tenés SAB: elegí otra salvación",{ intelligence: "Inteligencia",charisma: "Carisma" },c.ironMind ?? "");
  out += `<fieldset><legend>Conjuros conocidos · Sabiduría</legend><p>${RANGER_KNOWN[level]} conocidos ordinarios. Los conjuros adicionales del arquetipo no ocupan cupo. No hay preparación diaria ni lanzamiento ritual de clase.</p>${bonus ? `<p>Magia del arquetipo: ${html(PHB_SPELLS[bonus]!.name)}, adicional a los conocidos de la tabla.</p>` : ""}${Array.from({ length: RANGER_KNOWN[level]!-RANGER_KNOWN[level-1]! },(_,i) => select(`rangerLearn${i}`,`Conjuro nuevo ${i+1}`,spells(eligible),c.learn[i])).join("")}${known.length ? select("rangerSpellOld","Sustituir un conocido (opcional)",spells(known),c.replaceSpell?.oldKey) : ""}${c.replaceSpell ? select("rangerSpellNew","Sustituto de la lista de Explorador",spells(eligible),c.replaceSpell.newKey) : ""}</fieldset>`;
  out += (archetype ? RANGER_FEATURES[archetype].filter((f) => f.level === level).map((f) => `<h4>${html(f.name)}</h4><p>${html(f.description)}</p>`).join("") : "");
  for (const key of [...c.learn,c.replaceSpell?.newKey ?? ""]) if (PHB_SPELLS[key]) out += `<details><summary>${html(PHB_SPELLS[key]!.name)}</summary><p>${html(PHB_SPELLS[key]!.description)}</p></details>`;
  return out;
}
export function readRangerLevel(data: FormData,choice: FighterLevelChoice) {
  const t = (n: string) => String(data.get(n) ?? ""),c = { ...choice.ranger };
  if (data.has("rangerEnemyType")) c.enemy = readEnemy(data,c.enemy);
  if (data.has("rangerTerrain")) c.terrain = (t("rangerTerrain") || null) as typeof c.terrain;
  if (data.has("rangerStyle")) c.style = (t("rangerStyle") || null) as typeof c.style;
  if (data.has("rangerArchetype")) { const archetype = (t("rangerArchetype") || null) as typeof c.archetype;if (archetype !== c.archetype) { c.hunter = "";c.companion = null; }c.archetype = archetype; }
  if (data.has("rangerHunter")) c.hunter = t("rangerHunter");
  if (data.has("rangerIronMind")) c.ironMind = (t("rangerIronMind") || null) as typeof c.ironMind;
  if (data.has("rangerCompanionPreset")) {
    const key = t("rangerCompanionPreset"),preset = c.companion ? Object.keys(RANGER_COMPANIONS).find((k) => RANGER_COMPANIONS[k]!.species === c.companion!.species) ?? "custom" : "";
    if (key !== preset) c.companion = key ? structuredClone(RANGER_COMPANIONS[key] ?? { ...RANGER_COMPANIONS.wolf!,name: "Compañero",species: "Bestia elegida" }) : null;
    else if (c.companion && data.has("rangerCompanionName")) c.companion = readCompanion(data,c.companion);
  }
  if (data.has("rangerLearn0")) c.learn = [0,1].filter((i) => data.has(`rangerLearn${i}`)).map((i) => t(`rangerLearn${i}`));
  if (data.has("rangerSpellOld")) c.replaceSpell = t("rangerSpellOld") ? { oldKey: t("rangerSpellOld"),newKey: t("rangerSpellNew") } : null;
  return { ...choice,ranger: c };
}
