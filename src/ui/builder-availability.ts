import { rangerLanguages } from "../domain/character/ranger-catalog";
import { bardClassSkills,bardClassTools,bardClassExpertise } from "../domain/character/bard-catalog";
import { rogueClassSkills,rogueClassTools,rogueClassExpertise,THIEVES_EXPERTISE } from "../domain/character/rogue-catalog";
import type { FighterCreation, FighterLevelChoice, CharacterBuilderState } from "../domain/character/character-builder-model";
import { FeatChoiceSchema } from "../domain/character/character-builder-model";
import type { CharacterV2 } from "../domain/character/character-v2";
import { racialSkillGrants, validateFeat,builderFeats } from "../domain/character/fighter-build-rules";
import { BUILDER_RACES } from "../domain/character/fighter-builder-catalog";
import { fighterBuilderScores } from "../domain/character/fighter-builder";
import { FEATS } from "../domain/character/phb-fighter-choices";
import { PHB_SPELLS } from "../domain/character/phb-spells";
import { clericHeavyArmor,clericMartialWeapons } from "../domain/character/cleric-catalog";
import { INVOCATIONS } from "../domain/character/warlock-catalog";
import { replayWarlockChoices } from "../domain/character/warlock-builder";

/** Apply availability before creating the dialog's in-page select controls. */
export function applyBuilderAvailability(form: HTMLFormElement,c: FighterCreation,character: CharacterV2 | null,choice: FighterLevelChoice | null) {
  const controls = [...form.querySelectorAll<HTMLSelectElement>("select")];
  const disabled = (control: HTMLSelectElement,option: HTMLOptionElement,reason: string) => {
    if (option.disabled) return;
    option.disabled = true; option.title = reason; option.textContent += ` — ${reason}`;
    if (option.value === control.value) {
      const help = document.createElement("small"); help.className = "builder-help"; help.textContent = `${reason}. Elegí otra opción.`; control.after(help);
    }
  };
  const state: CharacterBuilderState = (choice ? character?.builder : null) ?? { schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: c.classKey,creationOperationId: "build_00000000000000000000000000000000",creation: { ...c,initialFeat: null },levels: [] };
  const knownSkills: string[] = [...bardClassSkills(state),...(choice?.bard.skills ?? []),...rogueClassSkills(state),...c.skills,...c.background.skills,...racialSkillGrants(c),...c.cleric.skills,...builderFeats(state).flatMap(({ feat }) => feat.skills),...state.levels.map((s) => s.xanathar.skill).filter(Boolean),...(choice && character ? Object.entries(character.checks.skills).filter(([,value]) => value.proficiency > 0).map(([key]) => key) : [])];
  const knownTools = [...(c.classKey === "druid" ? ["Kit de herborista"] : []),...bardClassTools(state),...rogueClassTools(state),...c.background.tools,...(choice && character ? character.proficiencies.tools : []),...(c.race === "rock-gnome" ? ["Herramientas de hojalatero"] : []),...(c.dwarfTool ? [({ smith: "Herramientas de herrero",brewer: "Suministros de cervecero",mason: "Herramientas de albañil" })[c.dwarfTool]] : []),...(c.classKey === "cleric" && c.cleric.domain === "forge" ? ["Herramientas de herrero"] : [])];
  const warlock = choice && state.classKey === "warlock" ? replayWarlockChoices(state) : null;
  const skills = (name: string): string[] => /^xgeSkill$/.test(name) ? [...c.skills,...c.background.skills,...racialSkillGrants(c)] : /^skill\d$/.test(name) ? c.skills.filter((_,i) => name !== `skill${i}`) : /^backgroundSkill/.test(name) ? [...c.skills,...racialSkillGrants(c),...c.cleric.skills,...c.background.skills.filter((_,i) => name !== `backgroundSkill${i}`)] : /^originSkill/.test(name) ? [...c.skills,...c.background.skills,...c.cleric.skills,...c.origin.skills.filter((_,i) => name !== `originSkill${i}`)] : name === "racialSkillReplacement" ? [...c.skills,...c.background.skills,...c.origin.skills,...c.cleric.skills] : /^clericSkill/.test(name) ? [...c.skills,...c.background.skills,...racialSkillGrants(c),...c.cleric.skills.filter((_,i) => name !== `clericSkill${i}`)] : [];
  for (const control of controls) {
    const name = control.name, blockedSkills = skills(name);
    for (const option of [...control.options]) {
      if (!option.value) continue;
      if (/Proficiency\d$|RacialSkill$/.test(name) && (option.value.startsWith("skill:") || !option.value.includes(":")) && knownSkills.includes(option.value.replace(/^skill:/,""))) { disabled(control,option,"Ya tenés esta competencia por tu clase, raza, dominio o trasfondo"); continue; }
      if ((/Proficiency\d$/.test(name) && option.value.startsWith("tool:") || /RacialTool$|^artisanTool$/.test(name)) && knownTools.includes(option.value.replace(/^tool:/,""))) { disabled(control,option,"Ya tenés competencia con esta herramienta"); continue; }
      if (/Expertise$/.test(name)) {
        const newSkill = controls.find((peer) => peer.name === name.replace(/Expertise$/,"RacialSkill"))?.value;
        const expert = bardClassExpertise(state).includes(option.value) || rogueClassExpertise(state).includes(option.value) || character?.checks.skills[option.value as keyof typeof character.checks.skills]?.proficiency === 2 || c.cleric.domain === "knowledge" && c.cleric.skills.includes(option.value);
        if (expert || !knownSkills.includes(option.value) && newSkill !== option.value) { disabled(control,option,expert ? "Ya tenés pericia en esta habilidad" : "Requiere competencia en esta habilidad"); continue; }
      }
      if (/^bardSkill\d$/.test(name) && ([...bardClassSkills(state),...c.skills,...c.background.skills,...racialSkillGrants(c),...builderFeats(state).flatMap(({ feat }) => feat.skills)].includes(option.value) || controls.some((p) => p !== control && /^bardSkill\d$/.test(p.name) && p.value === option.value))) { disabled(control,option,"Ya tenés o elegiste esta competencia"); continue; }
      if (/^bardInstrument\d$/.test(name) && (c.background.tools.includes(option.value) || controls.some((p) => p !== control && /^bardInstrument\d$/.test(p.name) && p.value === option.value))) { disabled(control,option,"Ya tenés esta competencia por el trasfondo u otro instrumento"); continue; }
      if (/^bardExpertise\d$/.test(name)) {
        const expert = bardClassExpertise(state).includes(option.value) || character?.checks.skills[option.value as keyof typeof character.checks.skills]?.proficiency === 2;
        const proficient = knownSkills.includes(option.value) || (choice?.bard.skills ?? []).includes(option.value);
        if (expert || !proficient) { disabled(control,option,expert ? "Ya tenés pericia en esta habilidad" : "Requiere competencia en esta habilidad"); continue; }
      }
      if (/^rogueExpertise\d$/.test(name)) {
        const priorExperts = choice ? [...rogueClassExpertise(state),...Object.entries(character?.checks.skills ?? {}).filter(([,v]) => v.proficiency === 2).map(([k]) => k)] : [...(c.initialFeat?.expertise ? [c.initialFeat.expertise] : [])];
        const expert = priorExperts.includes(option.value);
        const proficient = option.value === THIEVES_EXPERTISE || [...knownSkills,...(c.initialFeat?.skills ?? [])].includes(option.value);
        if (expert || !proficient) { disabled(control,option,expert ? "Ya ten\u00e9s pericia en esta competencia" : "Requiere competencia previa en esta habilidad"); continue; }
      }
      if (/^rogueTool\d$/.test(name) && knownTools.includes(option.value)) { disabled(control,option,"Ya ten\u00e9s competencia con esta herramienta"); continue; }
      if (name === "rangerTerrain" && [c.ranger.terrain,...state.levels.map((s) => s.ranger.terrain)].filter(Boolean).includes(option.value as typeof c.ranger.terrain) && !!choice) { disabled(control,option,"Ya elegiste este terreno predilecto"); continue; }
      if (name === "rangerEnemyType" && option.value !== "humanoids" && !!choice && [c.ranger.enemy,...state.levels.map((s) => s.ranger.enemy)].some((e) => e?.type === option.value)) { disabled(control,option,"Ya elegiste este tipo de enemigo"); continue; }
      if (name === "rangerEnemyLanguage" && [...BUILDER_RACES[c.race].languages,...c.languages,...c.background.languages,...(choice ? rangerLanguages(state) : []),...builderFeats(state).flatMap(({ feat }) => feat.languages)].includes(option.value)) { disabled(control,option,"Ya conocés este idioma por raza, trasfondo, clase o dote"); continue; }
      if (warlock && /^warlockInvocation(?:\d|New)$/.test(name)) {
        const definition = INVOCATIONS[option.value], current = choice!.warlock;
        const boon = current.boon ?? warlock.boon;
        const cantrips = [...warlock.cantrips,...warlock.tomeCantrips,...current.cantrips,...current.tomeCantrips,...builderFeats(state).flatMap(({ feat }) => feat.spells)];
        const selectedInv = [...warlock.invocations,...current.invocations,current.replaceInvocation?.newKey];
        const spells = [...warlock.spells.filter((k) => k !== current.replaceSpell?.oldKey),...current.learn,current.replaceSpell?.newKey];
        const reason = !definition ? "Invocación desconocida" : definition.level > choice!.level ? `Requiere Brujo ${definition.level}` : definition.boon && definition.boon !== boon ? `Requiere Pacto ${definition.boon === "blade" ? "del Filo" : definition.boon === "tome" ? "del Tomo" : "de la Cadena"}` : definition.blast && !cantrips.includes("eldritch-blast") ? "Requiere conocer Descarga Sobrenatural" : definition.curse && !spells.includes("hex") && warlock.patron !== "hexblade" && !selectedInv.includes("sign-of-ill-omen") ? "Requiere Maleficio o un rasgo que maldiga" : "";
        if (reason) { disabled(control,option,reason); continue; }
      }
      if (blockedSkills.includes(option.value)) {
        disabled(control,option,(c.skills as string[]).includes(option.value) && !/^skill\d$/.test(name) ? "Ya tenés esta competencia por tu clase" : "Ya elegida por otra competencia de raza, dominio o trasfondo"); continue;
      }
      if (name === "dwarfTool" && option.value === "smith" && c.classKey === "cleric" && c.cleric.domain === "forge") disabled(control,option,"Forja ya concede herramientas de herrero");
      if (name === "clericWeapon" && option.value === "warhammer" && !clericMartialWeapons(c.cleric.domain) && !c.race.includes("dwarf") && !(c.initialFeat?.key === "weapon-master" && c.initialFeat.weapons.includes("warhammer"))) disabled(control,option,"Requiere competencia con martillo de guerra");
      if (name === "clericArmor" && option.value === "chain-mail" && !clericHeavyArmor(c.cleric.domain) && c.initialFeat?.key !== "heavily-armored") disabled(control,option,"Requiere competencia en armadura pesada");
      if (/^(?:initialFeat|levelFeat)Key$/.test(name)) {
        const feat = FeatChoiceSchema.parse({ key: option.value,ability: FEATS[option.value as keyof typeof FEATS]?.abilities[0] ?? null });
        try { validateFeat(feat,fighterBuilderScores(state),state); }
        catch (e) { const reason = e instanceof Error ? e.message : ""; if (/requisito|ya elegiste|ya tenés|ya se eligió|repetir|no permite|misma dote/i.test(reason)) disabled(control,option,reason); }
      }
      if (/^(raceLanguage|xgeLanguage|clericLanguage\d|rogueLanguage\d|(?:initialFeat|levelFeat)(?:Language\d|RacialLanguage))$/.test(name)) {
        const other = controls.filter((peer) => peer !== control && /Language(?:\d)?$|^raceLanguage$/.test(peer.name)).map((peer) => peer.value);
        const known = [...rangerLanguages(state),...BUILDER_RACES[c.race].languages,...c.background.languages,...(name === "raceLanguage" ? [] : c.languages),...(choice && character ? character.proficiencies.languages : []),...(/^clericLanguage/.test(name) ? [] : c.cleric.languages)];
        if ([...known,...other].includes(option.value)) disabled(control,option,"Ya conocés o elegiste este idioma");
      }
    }
    const family = /^(originAbility|maneuver|(?:initialFeat|levelFeat)(?:Proficiency|Maneuver|Weapon)|warlockInvocation|rogueTool|rogueExpertise|bardExpertise|bardInstrument)(\d)$/.exec(name);
    if (family) {
      const peers = controls.filter((peer) => peer !== control && peer.name.startsWith(family[1]!) && /\d$/.test(peer.name)).map((peer) => peer.value);
      for (const option of [...control.options]) if (option.value && peers.includes(option.value)) disabled(control,option,"Ya elegida en otra selección");
    }
    if (/^asi(?:First|Second)$/.test(name)) {
      const peer = controls.find((other) => other.name === (name === "asiFirst" ? "asiSecond" : "asiFirst"));
      const scores = character?.abilities ?? fighterBuilderScores(state);
      for (const option of [...control.options]) if ((scores[option.value as keyof typeof scores] ?? 0)+(peer?.value === option.value ? 1 : 0) >= 20) disabled(control,option,"El atributo alcanzaría su máximo de 20");
    }
  }
  // Learning and knowing are separate from selecting mastery/signature/preparation.
  const learns = controls.filter((control) => /^(?:wizard(?:Cantrip|Learn|BonusCantrip)|warlock(?:Cantrip|Learn|SpellNew|Tome|Ritual)|ranger(?:Learn|SpellNew)|druid(?:Cantrip|BonusCantrip)|bard(?:Cantrip|Learn|SpellNew|Secret)|rogue(?:Cantrip|Learn|New)|cleric(?:Cantrip|NatureCantrip)|magic(?:Cantrip|Learn|New)|xgeCantrip|originCantrip|(?:initialFeat|levelFeat)(?:Spell|RacialSpell))\d*$/.test(control.name));
  const automaticCantrips = [...(c.classKey === "rogue" && choice?.rogue.archetype === "arcane-trickster" ? ["mage-hand"] : []),...(c.race === "forest-gnome" ? ["minor-illusion"] : c.race === "tiefling" ? ["thaumaturgy"] : c.race === "drow" ? ["dancing-lights"] : []),...(c.classKey === "cleric" && c.cleric.domain === "light" ? ["light"] : c.classKey === "cleric" && c.cleric.domain === "grave" ? ["spare-the-dying"] : c.classKey === "warlock" && c.warlock.patron === "celestial" ? ["light","sacred-flame"] : [])];
  const alreadyKnown = [...automaticCantrips,...((choice ? character : null)?.spellcasting.spells.filter((spell) => spell.level === 0 || !["wizard","cleric","druid"].includes(spell.casting?.kind ?? "")).map((spell) => spell.casting?.key).filter(Boolean) ?? [])];
  for (const control of learns) {
    const peers = learns.filter((other) => other !== control).map((other) => other.value).filter(Boolean);
    for (const option of [...control.options]) {
      if (!PHB_SPELLS[option.value]) continue;
      if (option.value === control.value) { if (peers.includes(option.value) || alreadyKnown.includes(option.value)) disabled(control,option,"Conjuro ya conocido o repetido en otra selección"); continue; }
      if (peers.includes(option.value) || alreadyKnown.includes(option.value)) option.remove();
    }
  }
  for (const prefix of ["wizardSignature","arcaneShot"]) {
    const peers = controls.filter((control) => control.name.startsWith(prefix));
    for (const control of peers) for (const option of [...control.options]) if (option.value && option.value !== control.value && peers.some((other) => other !== control && other.value === option.value)) option.remove();
  }
}
