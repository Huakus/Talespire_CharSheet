import { MONK_TRADITIONS,PALADIN_OATHS,ELEMENTAL_DISCIPLINES } from "./martial-catalog";
import { SORCERER_ORIGINS,SORCERER_AFFINITIES,METAMAGIC } from "./sorcerer-catalog";
import type { CharacterBuilderState,FighterLevelChoice,FeatChoice } from "./character-builder-model";
import { BUILDER_ABILITIES } from "./character-builder-model";
import { BUILDER_RACES,BUILDER_WEAPONS,DWARF_TOOLS,FIGHTING_STYLES,PHB_EQUIPMENT } from "./fighter-builder-catalog";
import { SAVE_DEFINITIONS,SKILL_DEFINITIONS,type SkillKey } from "./character-checks";
import { SUBCLASSES,DRAGON_ANCESTRIES } from "./phb-character-options";
import { FEATS,MANEUVERS } from "./phb-fighter-choices";
import { WIZARD_SCHOOLS } from "./wizard-catalog";
import { WARLOCK_PATRONS,PACT_BOONS,INVOCATIONS } from "./warlock-catalog";
import { CLERIC_DOMAINS } from "./cleric-catalog";
import { ROGUE_ARCHETYPES } from "./rogue-catalog";
import { BARD_COLLEGES } from "./bard-catalog";
import { BARBARIAN_PATHS,TOTEM_ANIMALS,STORM_ENVIRONMENTS } from "./barbarian-catalog";
import { DRUID_CIRCLES,DRUID_LANDS } from "./druid-catalog";
import { RANGER_ARCHETYPES,RANGER_ENEMIES,RANGER_TERRAINS,HUNTER_OPTIONS } from "./ranger-catalog";
import { ARCANE_SHOTS } from "./xanathar-fighter";
import { PHB_SPELLS } from "./phb-spells";

export interface ProgressionChoice { label: string;value: string;description?: string }
export interface ProgressionReplacement { label: string;before: string;after: string }
export const progressionSpellName = (key: string) => PHB_SPELLS[key]?.name ?? key;
const skill = (key: string) => key === "thieves-tools" ? "Herramientas de ladrón" : SKILL_DEFINITIONS[key as SkillKey]?.label ?? key;
const weapon = (key: string) => PHB_EQUIPMENT[key]?.name ?? key;
const damage: Record<string,string> = { acid: "Ácido",cold: "Frío",fire: "Fuego",lightning: "Relámpago",thunder: "Trueno",radiant: "Radiante",necrotic: "Necrótico" };

export function progressionChoices(state: CharacterBuilderState,step: FighterLevelChoice|null) {
  const c = state.creation,level = step?.level ?? 1,pick = step ?? c,decisions: ProgressionChoice[] = [],replacements: ProgressionReplacement[] = [];
  const add = (label: string,value: string|null|undefined,description?: string) => { if (value) decisions.push({ label,value,...(description ? { description } : {}) }); };
  const many = (label: string,values: readonly string[],translate: (key: string) => string = (s) => s) => add(label,values.map(translate).join(" · "));
  const spells = (label: string,keys: string[]) => many(label,keys,progressionSpellName);
  const replace = (label: string,value: { oldKey: string;newKey: string }|null,translate = progressionSpellName) => { if (value) replacements.push({ label,before: translate(value.oldKey),after: translate(value.newKey) }); };
  const feat = (f: FeatChoice|null) => {
    if (!f) return;add("Dote",FEATS[f.key].name,FEATS[f.key].description);if (f.ability) add("Atributo de la dote",SAVE_DEFINITIONS[f.ability].label);
    many("Habilidades de la dote",f.skills,skill);many("Herramientas de la dote",f.tools);many("Idiomas de la dote",f.languages);spells("Conjuros de la dote",f.spells);
    if (f.expertise) add("Pericia de la dote",skill(f.expertise));if (f.spellClass) add("Lista de conjuros de la dote",({ bard: "Bardo",cleric: "Clérigo",druid: "Druida",sorcerer: "Hechicero",warlock: "Brujo",wizard: "Mago" })[f.spellClass]);
    if (f.damageType) add("Daño de la dote",damage[f.damageType]);many("Maniobras de la dote",f.maneuvers,(s) => MANEUVERS[s as keyof typeof MANEUVERS]?.name ?? s);many("Armas de la dote",f.weapons,weapon);
  };
  if (!step) {
    add("Raza y subraza",BUILDER_RACES[c.race].name);add("Trasfondo",c.background.name,c.background.featureDescription);add("Rasgo de trasfondo",c.background.featureName);
    add("Método de atributos",({ "standard-array": "Valores estándar","point-buy": "Compra de 27 puntos",rolled: "Tiradas" })[c.abilityMethod]);
    many("Atributos base",BUILDER_ABILITIES.map((a) => `${SAVE_DEFINITIONS[a].label} ${c.baseAbilities[a]}`));many("Aumentos raciales elegidos",c.origin.abilities,(a) => `${SAVE_DEFINITIONS[a as keyof typeof SAVE_DEFINITIONS].label} +1`);
    many("Habilidades de clase",c.skills,skill);many("Habilidades de trasfondo",c.background.skills,skill);many("Habilidades raciales elegidas",c.origin.skills,skill);if (c.racialSkillReplacement) add("Sustitución de habilidad racial repetida",skill(c.racialSkillReplacement));
    many("Idiomas raciales elegidos",c.languages);many("Idiomas de trasfondo",c.background.languages);many("Herramientas de trasfondo",c.background.tools);if (c.dwarfTool) add("Herramientas del enano",DWARF_TOOLS[c.dwarfTool]);
    if (c.origin.ancestry) add("Ascendencia dracónica",DRAGON_ANCESTRIES[c.origin.ancestry].name);if (c.origin.cantrip) spells("Truco racial elegido",[c.origin.cantrip]);feat(c.initialFeat);
    add("Equipo inicial",c.equipment.method === "gold" ? `${c.equipment.goldRoll.join(" + ")} = ${c.equipment.goldRoll.reduce((a,b) => a+b,0)}; × 10 = ${c.equipment.goldRoll.reduce((a,b) => a+b,0)*10} po para compras` : "Paquetes de clase y trasfondo");
    if (c.equipment.method === "gold") many("Compras",c.equipment.purchases.map((p) => `${weapon(p.key)} ×${p.quantity}${p.equipped ? " (equipado)" : ""}`));
  } else {
    if (step.subclass) add(state.classKey === "wizard" ? "Tradición arcana" : "Arquetipo",state.classKey === "wizard" ? WIZARD_SCHOOLS[step.subclass as keyof typeof WIZARD_SCHOOLS] : SUBCLASSES[step.subclass as keyof typeof SUBCLASSES]);
    if (step.abilityIncrease) many("Mejora de atributos",BUILDER_ABILITIES.filter((a) => step.abilityIncrease![a] > 0).map((a) => `${SAVE_DEFINITIONS[a].label} +${step.abilityIncrease![a]}`));feat(step.feat);if (step.skipImprovement) add("Mejora/dote","Se renunció voluntariamente a este beneficio");
    if (step.additionalStyle) add("Estilo adicional",FIGHTING_STYLES[step.additionalStyle].name);
    many("Maniobras aprendidas",step.maneuvers,(s) => MANEUVERS[s as keyof typeof MANEUVERS]?.name ?? s);replace("Maniobra",step.maneuverReplacement,(s) => MANEUVERS[s as keyof typeof MANEUVERS]?.name ?? s);add("Herramientas de artesano",step.artisanTool);
    many("Disparos arcanos",step.xanathar.shots,(s) => ARCANE_SHOTS[s]?.name ?? s);if (step.xanathar.skill) add("Habilidad del arquetipo",skill(step.xanathar.skill));add("Idioma del arquetipo",step.xanathar.language);if (step.xanathar.cantrip) spells("Truco del arquetipo",[step.xanathar.cantrip]);if (step.xanathar.bonusSave) add("Salvación alternativa",SAVE_DEFINITIONS[step.xanathar.bonusSave].label);
  }
  if (state.classKey === "fighter") { if (!step) add("Estilo de combate",FIGHTING_STYLES[c.style].name);if (step) { spells("Trucos aprendidos",step.magic.cantrips);spells("Conjuros aprendidos",step.magic.learn.map((s) => s.key));replace("Conjuro",step.magic.replace); } }
  if (state.classKey === "wizard") { const w = pick.wizard;spells("Trucos aprendidos",w.cantrips);spells("Conjuros añadidos al libro",w.learn);if (w.bonusCantrip) spells("Truco adicional",[w.bonusCantrip]);spells("Maestría de conjuros",w.mastery);spells("Conjuros característicos",w.signature);if (w.prepared) spells("Preparación registrada en el tutorial",w.prepared); }
  if (state.classKey === "warlock") { const w = pick.warlock;if (w.patron) add("Patrón",WARLOCK_PATRONS[w.patron]);add("Acuerdo del pacto",w.story);if (w.boon) add("Don del pacto",PACT_BOONS[w.boon]);if (w.pactWeapon) add("Arma del pacto elegida",weapon(w.pactWeapon));spells("Trucos aprendidos",w.cantrips);spells("Conjuros aprendidos",w.learn);spells("Trucos del Tomo",w.tomeCantrips);spells("Rituales elegidos",w.rituals);if (w.arcanum) spells("Arcano místico",[w.arcanum]);many("Invocaciones elegidas",w.invocations,(s) => INVOCATIONS[s]?.name ?? s);replace("Conjuro",w.replaceSpell);replace("Invocación",w.replaceInvocation,(s) => INVOCATIONS[s]?.name ?? s); }
  if (state.classKey === "cleric") { const p = pick.cleric;if (p.domain) add("Dominio",CLERIC_DOMAINS[p.domain]);add("Deidad",p.deity);many("Habilidades del dominio",p.skills,skill);many("Idiomas del dominio",p.languages);spells("Trucos aprendidos",p.cantrips);if (p.natureCantrip) spells("Truco de Naturaleza",[p.natureCantrip]);if (p.prepared) spells("Preparación registrada en el tutorial",p.prepared); }
  if (state.classKey === "rogue") { const p = pick.rogue;if (p.archetype) add("Arquetipo",ROGUE_ARCHETYPES[p.archetype]);many("Pericias elegidas",p.expertise,skill);many("Herramientas elegidas",p.tools);many("Idiomas elegidos",p.languages);spells("Trucos aprendidos",p.cantrips);spells("Conjuros aprendidos",p.learn.map((s) => s.key));replace("Conjuro",p.replace); }
  if (state.classKey === "barbarian") { const p = pick.barbarian;if (p.path) add("Senda",BARBARIAN_PATHS[p.path]);if (p.totem) add(`Tótem de nivel ${level}`,TOTEM_ANIMALS[p.totem]);if (p.divineDamage) add("Daño de Furia Divina",damage[p.divineDamage]);if (p.storm) { const previous = [...state.levels].reverse().find((s) => s.level < level && s.barbarian.storm)?.barbarian.storm;if (previous && previous !== p.storm) replacements.push({ label: "Entorno de tormenta",before: STORM_ENVIRONMENTS[previous],after: STORM_ENVIRONMENTS[p.storm] });else add("Entorno de tormenta",STORM_ENVIRONMENTS[p.storm]); } }
  if (state.classKey === "bard") { const p = pick.bard;if (p.college) add("Colegio",BARD_COLLEGES[p.college]);many("Instrumentos elegidos",p.instruments);many("Habilidades elegidas",p.skills,skill);many("Pericias elegidas",p.expertise,skill);if (p.style) add("Estilo de combate",FIGHTING_STYLES[p.style].name);spells("Trucos aprendidos",p.cantrips);spells("Conjuros aprendidos",p.learn);spells("Secretos Mágicos",p.secrets);replace("Conjuro",p.replaceSpell); }
  if (state.classKey === "druid") { const p = pick.druid;if (p.circle) add("Círculo",DRUID_CIRCLES[p.circle]);if (p.land) add("Terreno del Círculo de la Tierra",DRUID_LANDS[p.land]);spells("Trucos aprendidos",p.cantrips);if (p.bonusCantrip) spells("Truco adicional",[p.bonusCantrip]);if (p.prepared) spells("Preparación registrada en el tutorial",p.prepared); }
  if (state.classKey === "monk") {
    const p = step?.monk ?? state.creation.monk;
    if(p.tool) add("Herramienta de monje",p.tool);
    if(p.tradition) add("Tradición monástica",MONK_TRADITIONS[p.tradition]);
    p.weapons.forEach((k) => add("Arma kensei",BUILDER_WEAPONS[k]?.name ?? k));
    if(p.brush) add("Camino del Pincel",p.brush === "calligrapher" ? "Calígrafo" : "Pintor");
    p.disciplines.forEach((k) => add("Disciplina elemental",ELEMENTAL_DISCIPLINES[k]?.name ?? k));
    if(p.replacement) replacements.push({label:"Disciplina elemental",before:ELEMENTAL_DISCIPLINES[p.replacement.oldKey]?.name ?? p.replacement.oldKey,after:ELEMENTAL_DISCIPLINES[p.replacement.newKey]?.name ?? p.replacement.newKey});
  }
  if (state.classKey === "paladin") {
    const p = step?.paladin ?? state.creation.paladin;
    if(p.oath) add("Juramento sagrado",PALADIN_OATHS[p.oath]);
    if(p.style) add("Estilo de combate",FIGHTING_STYLES[p.style].name);
    if(p.prepared) add("Preparación inicial",p.prepared.map(progressionSpellName).join(" · "));
  }
  if (state.classKey === "sorcerer") { const p = pick.sorcerer;if (p.origin) add("Origen",SORCERER_ORIGINS[p.origin]);if (p.ancestry) add("Ancestro dragón",DRAGON_ANCESTRIES[p.ancestry].name);if (p.affinity) add("Afinidad divina",SORCERER_AFFINITIES[p.affinity]);spells("Trucos aprendidos",p.cantrips);spells("Conjuros aprendidos",p.learn);many("Metamagia elegida",p.metamagic,(m) => METAMAGIC[m as keyof typeof METAMAGIC].name);replace("Conjuro",p.replaceSpell); }
  if (state.classKey === "ranger") { const p = pick.ranger;if (p.archetype) add("Arquetipo",RANGER_ARCHETYPES[p.archetype]);if (p.style) add("Estilo de combate",FIGHTING_STYLES[p.style].name);if (p.hunter) { const h = HUNTER_OPTIONS[level]![p.hunter]!;add("Rasgo de Cazador elegido",h.name,h.description); }if (p.terrain) add("Terreno predilecto",RANGER_TERRAINS[p.terrain]);if (p.enemy) { add("Enemigo predilecto",p.enemy.type === "humanoids" ? p.enemy.humanoids.join(" y ") : RANGER_ENEMIES[p.enemy.type]);add("Idioma de enemigos",p.enemy.language || "Sin idioma nuevo"); }if (p.ironMind) add("Salvación de Mente de Hierro",SAVE_DEFINITIONS[p.ironMind].label);if (p.companion) add("Compañero inicial",`${p.companion.name} · ${p.companion.species} · VD ${p.companion.challenge}`,p.companion.notes);spells("Conjuros aprendidos",p.learn);replace("Conjuro",p.replaceSpell); }
  if (step) add("PG del nivel antes de Constitución",`${step.hpBase} · ${step.hpMethod === "rolled" ? "tirada registrada" : "valor fijo"}`);
  return { decisions,replacements };
}
