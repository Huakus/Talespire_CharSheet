import type { CharacterBuilderState,FighterLevelChoice } from "../domain/character/character-builder-model";
import { ARCANE_SHOTS,XGE_FIGHTER_SKILLS } from "../domain/character/xanathar-fighter";
import { SKILL_DEFINITIONS,type SkillKey } from "../domain/character/character-checks";
import { LANGUAGES } from "../domain/character/phb-character-options";
import { PHB_SPELLS } from "../domain/character/phb-spells";
const select = (name: string,label: string,values: Record<string,string>,value: string) => `<label>${label}<select name="${name}"><option value="">Elegí una opción</option>${Object.entries(values).map(([key,text]) => `<option value="${key}" ${key === value ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
export function xanatharFighterFields(state: CharacterBuilderState,choice: FighterLevelChoice) {
  const subclass = choice.level === 3 ? choice.subclass : state.levels.find((s) => s.level===3)?.subclass, x = choice.xanathar;
  if (!subclass || !(subclass in XGE_FIGHTER_SKILLS)) return "";
  let content = `<fieldset><legend>Arquetipo de Xanathar</legend><div class="builder-grid">`;
  if (choice.level===3) {
    const list = XGE_FIGHTER_SKILLS[subclass as keyof typeof XGE_FIGHTER_SKILLS];
    content += select("xgeSkill","Competencia adicional",Object.fromEntries(list.map((k) => [k,SKILL_DEFINITIONS[k as SkillKey].label])),x.skill);
    if (subclass !== "arcane-archer") content += select("xgeLanguage","O un idioma, en lugar de habilidad",Object.fromEntries(LANGUAGES.map((l) => [l,l])),x.language);
    else content += select("xgeCantrip","Truco de Saber del Arquero Arcano (Inteligencia)",Object.fromEntries(["prestidigitation","druidcraft"].map((k) => [k,PHB_SPELLS[k]!.name])),x.cantrip);
  }
  if (subclass === "arcane-archer") {
    const count = choice.level===3 ? 2 : [7,10,15,18].includes(choice.level) ? 1 : 0, known = state.levels.flatMap((s) => s.xanathar.shots);
    content += Array.from({ length: count },(_,i) => select(`arcaneShot${i}`,`Opción de Disparo Arcano ${i+1}`,Object.fromEntries(Object.entries(ARCANE_SHOTS).filter(([k]) => !known.includes(k)).map(([k,d]) => [k,d.name])),x.shots[i] ?? "")).join("");
    content += x.shots.filter((k) => ARCANE_SHOTS[k]).map((k) => `<p>${ARCANE_SHOTS[k]!.description}</p>`).join("");
  }
  if (subclass === "samurai" && choice.level === 7 && (state.creation.initialFeat?.key === "resilient" && state.creation.initialFeat.ability === "wisdom" || state.levels.some((s) => s.feat?.key === "resilient" && s.feat.ability === "wisdom") || choice.feat?.key === "resilient" && choice.feat.ability === "wisdom")) content += select("xgeBonusSave","Ya competente en SAB: salvación alternativa",{ intelligence: "Inteligencia",charisma: "Carisma" },x.bonusSave ?? "");
  return content+"</div></fieldset>";
}
export function readXanatharFighter(data: FormData,choice: FighterLevelChoice) {
  const text = (name: string) => String(data.get(name) ?? "");
  if (data.has("xgeSkill")) { choice.xanathar.skill = text("xgeSkill"); choice.xanathar.language = text("xgeLanguage"); }
  if (data.has("xgeCantrip")) choice.xanathar.cantrip = text("xgeCantrip");
  if (data.has("arcaneShot0")) choice.xanathar.shots = [0,1].filter((i) => data.has(`arcaneShot${i}`)).map((i) => text(`arcaneShot${i}`));
  if (data.has("xgeBonusSave")) choice.xanathar.bonusSave = (text("xgeBonusSave") || null) as "intelligence" | "charisma" | null;
  return choice;
}
