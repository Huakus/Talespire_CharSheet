import { martialInitialFields,martialEquipmentFields,readMartialInitial } from "./martial-builder-fields";
import { builderGoldMultiplier } from "../domain/character/fighter-builder-catalog";
import { sorcererIdentityFields,sorcererInitialFields,sorcererEquipmentFields,readSorcererInitial } from "./sorcerer-builder-fields";
import { rangerInitialFields,rangerEquipmentFields,readRangerInitial } from "./ranger-builder-fields";
import { druidInitialFields,druidEquipmentFields,readDruidInitial } from "./druid-builder-fields";
import { bardInitialFields,bardEquipmentFields,readBardInitial } from "./bard-builder-fields";
import { barbarianInitialFields,barbarianEquipmentFields,readBarbarianInitial } from "./barbarian-builder-fields";
import { rogueInitialFields,rogueEquipmentFields,readRogueInitial } from "./rogue-builder-fields";
import { clericIdentityFields,clericInitialFields,clericEquipmentFields,readClericInitial } from "./cleric-builder-fields";
import { applyBuilderAvailability } from "./builder-availability";
import { z } from "zod";
import type { CharacterV2 } from "../domain/character/character-v2";
import { BUILDER_ABILITIES, FighterCreationSchema, FighterLevelChoiceSchema, type FighterCreation, type FighterLevelChoice } from "../domain/character/character-builder-model";
import { defaultFighterCreation, BUILDER_RACES, BACKGROUND_PRESETS, DWARF_TOOLS, FIGHTING_STYLES, FIGHTER_SKILLS, FIGHTER_ASI_LEVELS, BUILDER_WEAPONS } from "../domain/character/fighter-builder-catalog";
import { fighterBuilderScores, validateFighterAbilities, pointBuyCost } from "../domain/character/fighter-builder";
import { buildGuidedCharacter, advanceGuidedCharacter, validateGuidedCreation } from "../domain/character/guided-character-builder";
import { WIZARD_ASI_LEVELS, WIZARD_SKILLS, defaultWizardCreation } from "../domain/character/wizard-catalog";
import { wizardInitialFields, readWizardInitial } from "./wizard-builder-fields";
import { SAVE_DEFINITIONS, SKILL_DEFINITIONS, type SkillKey } from "../domain/character/character-checks";
import { createDeterministicId } from "../shared/id";
import { featFields, readFeat, fighterLevelFields, readLevelFields } from "./builder-choice-fields";
import { TOOLS, LANGUAGES, DRAGON_ANCESTRIES, BACKGROUND_EQUIPMENT } from "../domain/character/phb-character-options";
import { PHB_SPELLS, classSpells } from "../domain/character/phb-spells";
import { PHB_EQUIPMENT, PHB_PURCHASABLE_EQUIPMENT, equipmentGoldCost } from "../domain/character/fighter-builder-catalog";
import { createRandomId } from "../shared/id";
import type { DiceRoller } from "../application/ports/dice-roller";
import contentNotice from "../domain/character/phb-content-notice.txt?raw";
import { builderClassProfile, BUILDER_CLASS_NAMES } from "./builder-class-profile";
import { warlockPatronFields,warlockInitialFields,readWarlockInitial,warlockEquipmentFields } from "./warlock-builder-fields";
import { bindDialogSelects } from "./dialog-selects";

interface BuilderOptions {
  campaignId: string;
  name?: string;
  character?: CharacterV2;
  diceRoller: DiceRoller;
  onCreate: (operationId: string, creation: FighterCreation, initialLevels: FighterLevelChoice[]) => Promise<void>;
  onAdvance: (choice: FighterLevelChoice) => Promise<void>;
}
const DraftSchema = z.object({
  version: z.literal(1), operationId: z.string(), step: z.number().int().min(0).max(24),
  creation: FighterCreationSchema.extend({ name: z.string().max(100) }),
  choice: FighterLevelChoiceSchema,
  initialLevels: z.array(FighterLevelChoiceSchema).max(19).default([]),
});
const html = (value: string): string => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const optionsHtml = (values: Record<string, string>, current: string | null) => Object.entries(values).map(([key, label]) => `<option value="${html(key)}" ${key === current ? "selected" : ""}>${html(label)}</option>`).join("");
const select = (name: string, label: string, values: Record<string,string>, current: string | null) => `<label>${html(label)}<select name="${name}">${optionsHtml(values, current)}</select></label>`;
const input = (name: string, label: string, value: string, attributes = "") => `<label>${html(label)}<input name="${name}" value="${html(value)}" ${attributes}></label>`;
const list = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);
let activeDialog: HTMLDialogElement | null = null;

export async function openCharacterBuilder(options: BuilderOptions): Promise<void> {
  if (activeDialog?.isConnected) { activeDialog.focus(); return; }
  const character = options.character ? structuredClone(options.character) : null;
  const level = character ? character.identity.level + 1 : 2;
  if (character && (!character.builder || level > 20)) throw new Error("La subida guiada requiere un personaje creado con el asistente y nivel menor que 20.");
  const key = `talespire-builder-v1:${options.campaignId}:${character ? `${character.id}:${level}` : "create"}`;
  let creation = character?.builder?.creation ?? defaultFighterCreation(options.name);
  let operationId = await createRandomId("build");
  const zero = Object.fromEntries(BUILDER_ABILITIES.map((ability) => [ability, 0])) as FighterCreation["baseAbilities"];
  let choice = FighterLevelChoiceSchema.parse({ operationId, level, hpMethod: "fixed", hpBase: builderClassProfile(creation.classKey).fixedHp, abilityIncrease: builderClassProfile(creation.classKey).asi.includes(level) ? { ...zero, [builderClassProfile(creation.classKey).ability]: 2 } : null, subclass: null, additionalStyle: null });
  let initialLevels: FighterLevelChoice[] = [];
  let levelContext: CharacterV2 | null = character;
  let step = 0;
  let resumed = false;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = DraftSchema.safeParse(JSON.parse(raw));
      if (parsed.success && /^build_[a-f0-9]{32}$/.test(parsed.data.operationId) && parsed.data.choice.operationId === parsed.data.operationId && (!character || parsed.data.choice.level === level)) {
        ({ creation, operationId, choice, step, initialLevels } = parsed.data);
        resumed = true;
      }
    }
  } catch { /* A missing/unavailable browser draft does not affect campaign data. */ }
  const stageNames = () => character ? ["Nuevo nivel", "Revisar"] : ["Identidad", "Atributos", "Formación", "Equipo", ...Array.from({ length: creation.startingLevel-1 }, (_, i) => `Nivel ${i+2}`), "Revisar"];
  let stages = stageNames();
  step = Math.min(step, stages.length - 1);
  let error = "";
  let busy = false;
  let stored = false;
  let generation = 0;
  let purchaseKey = "longsword", purchaseQuantity = 1;
  let dropdowns: ReturnType<typeof bindDialogSelects> | null = null;
  const dialog = document.createElement("dialog");
  dialog.className = "character-builder-dialog";
  dialog.setAttribute("aria-labelledby", "character-builder-title");
  activeDialog = dialog;
  const save = () => { try { localStorage.setItem(key, JSON.stringify({ version: 1, operationId, step, creation, choice, initialLevels })); stored = true; } catch { stored = false; } };
  const close = () => { if (busy) return; save(); dialog.close(); };
  const navigationItems = () => stages.map((title,index) => `<li><button type="button" data-builder-step="${index}" ${index > step || busy ? "disabled" : ""} ${index === step ? 'aria-current="step"' : ""}>${index+1}. ${title}</button></li>`).join("");
  const bindNavigation = (form: HTMLFormElement) => dialog.querySelectorAll<HTMLButtonElement>("[data-builder-step]").forEach((button) => button.addEventListener("click", () => { read(form); step = Number(button.dataset.builderStep); error = ""; save(); void render(); }));
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("close", () => { generation++; dropdowns?.dispose(); dialog.remove(); if (activeDialog === dialog) activeDialog = null; });

  const skillSelect = (name: string, label: string, current: SkillKey, keys: readonly SkillKey[]) => select(name, label, Object.fromEntries(keys.map((key) => [key, SKILL_DEFINITIONS[key].label])), current);
  const styleSelect = (name: string, value: string | null, exclude?: string) => select(name, "Estilo de combate", { ...(value === null ? { "": "Elegí un estilo" } : {}), ...Object.fromEntries(Object.entries(FIGHTING_STYLES).filter(([key]) => key !== exclude).map(([key, style]) => [key, style.name])) }, value);
  function body(): string {
    if (character || step >= 4 && step < stages.length-1) {
      if (step === stages.length-1) return "";
      const selected = character ? choice : initialLevels[step-4]!;
      return fighterLevelFields(levelContext!.builder!, levelContext!.abilities, selected,levelContext!.spellcasting.wizard?.copied);
    }
    if (step === 0) return `<h3>¿Quién es tu personaje?</h3><p>Personaje del Manual del Jugador 2014 y Xanathar. Clérigo elige dominio en nivel 1. Hechicero elige origen en nivel 1 y metamagia desde nivel 3. Explorador elige estilo en nivel 2 y arquetipo en nivel 3. Bárbaro, Guerrero y Pícaro eligen senda o arquetipo en nivel 3; Bardo elige colegio en nivel 3; Druida elige círculo en nivel 2 y Tierra elige terreno en nivel 3; Mago elige tradición arcana en nivel 2; Brujo elige patrón en nivel 1 y don en nivel 3. Podés crear directamente al nivel acordado con el GM.</p><div class="builder-grid">
      ${select("classKey","Clase",BUILDER_CLASS_NAMES,creation.classKey)}
      ${input("name", "Nombre", creation.name, 'maxlength="100" required')}${input("playerName", "Jugador", creation.playerName, 'maxlength="100"')}
      ${input("startingLevel", "Nivel inicial", String(creation.startingLevel), 'type="number" min="1" max="20" step="1"')}${select("allowFeats", "Dotes (regla opcional de mesa)", { yes: "Permitidas por la mesa", no: "Sin dotes" }, creation.allowFeats ? "yes" : "no")}${input("alignment", "Alineamiento", creation.alignment)}
      ${select("race", "Raza y subraza", Object.fromEntries(Object.entries(BUILDER_RACES).map(([key, race]) => [key, race.name])), creation.race)}
      ${["human", "human-variant", "high-elf", "half-elf"].includes(creation.race) ? select("raceLanguage", "Idioma adicional del origen", Object.fromEntries(LANGUAGES.map((lang) => [lang,lang])), creation.languages[0] ?? "Goblin") : ""}
      ${creation.race.includes("dwarf") ? select("dwarfTool", "Herramientas del enano", DWARF_TOOLS, creation.dwarfTool) : ""}</div>
      <div class="builder-grid">${input("appearance", "Edad, apariencia, altura y peso", creation.appearance)}${input("personalTrait0", "Rasgo de personalidad 1", creation.personalTraits[0] ?? "")}${input("personalTrait1", "Rasgo de personalidad 2", creation.personalTraits[1] ?? "")}${input("ideal", "Ideal", creation.ideal)}${input("bond", "Vínculo", creation.bond)}${input("flaw", "Defecto", creation.flaw)}</div>
      ${creation.race === "dragonborn" ? select("ancestry", "Ascendencia dracónica", { "": "Elegí ascendencia", ...Object.fromEntries(Object.entries(DRAGON_ANCESTRIES).map(([key, entry]) => [key, `${entry.name} · ${entry.damage} · ${entry.shape}`])) }, creation.origin.ancestry) : ""}
      ${creation.classKey === "sorcerer" ? sorcererIdentityFields(creation) : creation.classKey === "cleric" ? clericIdentityFields(creation) : creation.classKey === "warlock" ? warlockPatronFields(creation) : ""}
      <label>Historia y personalidad (opcional)<textarea name="personality" maxlength="3000">${html(creation.personality)}</textarea></label>
      <p class="builder-help">Podés incluir dos rasgos de personalidad, un ideal, un vínculo y un defecto, además de tu historia.</p>
      <p class="builder-help">Todas las razas y subrazas del PHB 2014. Drow, humano variante, dotes e idiomas exóticos se usan de acuerdo con el GM.</p>
      <details><summary>Fuentes y créditos</summary><p class="builder-content-notice">${html(contentNotice)}</p></details>`;
    if (step === 1) {
      const racial = BUILDER_RACES[creation.race].bonuses as Partial<FighterCreation["baseAbilities"]>;
      return `<h3>Asigná tus atributos</h3><p>${creation.classKey === "cleric" ? "Sabiduría determina tus conjuros, su preparación y tus rasgos de dominio." : creation.classKey === "warlock" ? "Carisma determina tus conjuros y varios beneficios del patrón; Constitución ayuda a concentrarte y aumenta tus PG." : creation.classKey === "wizard" ? "Inteligencia determina tus conjuros, preparación y varios rasgos de escuela; Constitución aumenta tus PG y ayuda a concentrarte." : "Fuerza o Destreza ayudan a tus ataques; Constitución aumenta tus PG."} Los aumentos raciales se añaden después.</p>
        ${select("abilityMethod", "Método", { "standard-array": "Valores estándar: 15, 14, 13, 12, 10, 8", "point-buy": "Compra de 27 puntos", rolled: "Tiradas: 4d6, descartando el menor" }, creation.abilityMethod)}
        <div class="builder-grid">${BUILDER_ABILITIES.map((key) => {
          const racialBonus = (racial[key] ?? 0) + creation.origin.abilities.filter((a) => a === key).length;
          return `${creation.abilityMethod === "rolled" ? `${input(`ability_${key}`, SAVE_DEFINITIONS[key].label, String(creation.baseAbilities[key]), 'type="number" min="3" max="18" step="1"')}<button type="button" data-builder-ability-roll="${key}">Tirar 4d6</button>` : select(`ability_${key}`, SAVE_DEFINITIONS[key].label, Object.fromEntries((creation.abilityMethod === "point-buy" ? [8,9,10,11,12,13,14,15] : [15,14,13,12,10,8]).map((v) => [String(v), String(v)])), String(creation.baseAbilities[key]))}<small data-builder-ability-total="${key}">${html(SAVE_DEFINITIONS[key].label)} con raza: ${creation.baseAbilities[key] + racialBonus}</small>`;
        }).join("")}</div>
        ${["human-variant", "half-elf"].includes(creation.race) ? `<div class="builder-grid">${[0,1].map((i) => select(`originAbility${i}`, `Aumento racial +1 (${i+1})`, Object.fromEntries(BUILDER_ABILITIES.filter((key) => creation.race !== "half-elf" || key !== "charisma").map((key) => [key, SAVE_DEFINITIONS[key].label])), creation.origin.abilities[i] ?? "strength")).join("")}</div>` : ""}
        <p>${creation.abilityMethod === "point-buy" ? `Puntos usados: ${pointBuyCost(creation.baseAbilities)} / 27` : creation.abilityMethod === "rolled" ? "Tirá cuatro d6 por atributo y sumá los tres mayores. Si TaleSpire confirma solo el envío, ingresá el resultado de la mesa." : "Usá cada valor estándar exactamente una vez."}</p>`;
    }
    if (step === 2) return `<h3>Elegí tu formación</h3><p>El trasfondo se puede personalizar según 2014. Elegí habilidades distintas de las de tu clase y raza.</p>
      <div class="builder-grid">${Array.from({ length: creation.classKey === "rogue" ? 4 : ["bard","ranger"].includes(creation.classKey) ? 3 : 2 },(_,i) => skillSelect(`skill${i}`,`Habilidad de clase ${i+1}`,creation.skills[i]!,builderClassProfile(creation.classKey).skills)).join("")}${creation.classKey !== "fighter" ? "" : styleSelect("style", creation.style)}</div>
      ${["monk","paladin"].includes(creation.classKey) ? martialInitialFields(creation) : creation.classKey === "sorcerer" ? sorcererInitialFields(creation) : creation.classKey === "ranger" ? rangerInitialFields(creation) : creation.classKey === "druid" ? druidInitialFields(creation) : creation.classKey === "bard" ? bardInitialFields(creation) : creation.classKey === "barbarian" ? barbarianInitialFields() : creation.classKey === "rogue" ? rogueInitialFields(creation) : creation.classKey === "cleric" ? clericInitialFields(creation) : creation.classKey === "warlock" ? warlockInitialFields(creation) : creation.classKey === "wizard" ? wizardInitialFields(creation) : `<p class="builder-help">${html(FIGHTING_STYLES[creation.style].description)}</p>`}
      ${select("backgroundPreset", "Base del trasfondo y equipo", Object.fromEntries(Object.entries(BACKGROUND_PRESETS).map(([key, background]) => [key, background.name])), creation.background.equipment)}
      <div class="builder-grid">${input("backgroundName", "Nombre del trasfondo", creation.background.name, 'maxlength="100"')}
      ${skillSelect("backgroundSkill0", "Habilidad del trasfondo 1", creation.background.skills[0]!, Object.keys(SKILL_DEFINITIONS) as SkillKey[])}${skillSelect("backgroundSkill1", "Habilidad del trasfondo 2", creation.background.skills[1]!, Object.keys(SKILL_DEFINITIONS) as SkillKey[])}
      ${input("backgroundTools", "Herramientas, separadas por comas", creation.background.tools.join(", "))}${input("backgroundLanguages", "Idiomas, separados por comas", creation.background.languages.join(", "))}
      ${input("featureName", "Rasgo de trasfondo", creation.background.featureName, 'maxlength="100"')}</div>
      <label>Descripción del rasgo<textarea name="featureDescription" maxlength="1500">${html(creation.background.featureDescription)}</textarea></label>
      ${["half-orc", "high-elf", "wood-elf", "drow"].includes(creation.race) && [...creation.skills, ...creation.background.skills].includes(creation.race === "half-orc" ? "intimidation" : "perception") ? `${select("racialSkillReplacement", "Competencia racial repetida: sustituta", { "": "Elegí otra habilidad", ...Object.fromEntries(Object.entries(SKILL_DEFINITIONS).map(([key, skill]) => [key, skill.label])) }, creation.racialSkillReplacement)}<p class="builder-help">Cuando dos fuentes conceden la misma competencia, elegí otra del mismo tipo.</p>` : ""}
      ${["human-variant", "half-elf"].includes(creation.race) ? `<div class="builder-grid">${Array.from({ length: creation.race === "half-elf" ? 2 : 1 }, (_, i) => skillSelect(`originSkill${i}`, `Habilidad racial ${i+1}`, creation.origin.skills[i] ?? "stealth", Object.keys(SKILL_DEFINITIONS) as SkillKey[])).join("")}</div>` : ""}
      ${creation.race === "high-elf" ? select("originCantrip", "Truco racial de mago (Inteligencia)", { "": "Elegí un truco", ...Object.fromEntries(classSpells("wizard", 0).map((key) => [key,PHB_SPELLS[key]!.name])) }, creation.origin.cantrip) : ""}
      ${creation.race === "human-variant" ? featFields("initialFeat", creation.initialFeat) : ""}
      <datalist id="builder-weapon-keys">${Object.entries(PHB_EQUIPMENT).filter(([,d]) => d.weapon).map(([key,d]) => `<option value="${key}">${html(d.name)}</option>`).join("")}</datalist>
      <details><summary>Idiomas y herramientas disponibles en el manual</summary><p>${LANGUAGES.map(html).join(" · ")}</p><p>${TOOLS.map(html).join(" · ")}</p></details>
      <p class="builder-help">Herramientas e idiomas deben sumar dos. Si personalizás el rasgo, acordalo con tu GM; el asistente registra su texto.</p>`;
    if (step === 3) {
      const weapons = Object.fromEntries(Object.entries(BUILDER_WEAPONS).filter(([,item]) => item.weapon!.category.startsWith("martial")).map(([key,item]) => [key,item.name]));
      if (["monk","paladin"].includes(creation.classKey) && creation.equipment.method === "packages") return martialEquipmentFields(creation);
      if (creation.classKey === "sorcerer" && creation.equipment.method === "packages") return sorcererEquipmentFields(creation);
      if (creation.classKey === "ranger" && creation.equipment.method === "packages") return rangerEquipmentFields(creation);
      if (creation.classKey === "druid" && creation.equipment.method === "packages") return druidEquipmentFields(creation);
      if (creation.classKey === "bard" && creation.equipment.method === "packages") return bardEquipmentFields(creation);
      if (creation.classKey === "barbarian" && creation.equipment.method === "packages") return barbarianEquipmentFields(creation);
      if (creation.classKey === "rogue" && creation.equipment.method === "packages") return rogueEquipmentFields(creation);
      if (creation.classKey === "cleric" && creation.equipment.method === "packages") return clericEquipmentFields(creation);
      if (creation.classKey === "warlock" && creation.equipment.method === "packages") return warlockEquipmentFields(creation);
      if (creation.classKey === "wizard" && creation.equipment.method === "packages") return `<h3>Prepará tu equipo de mago</h3>${select("equipmentMethod","Método de equipo",{ packages: "Paquetes de clase y trasfondo", gold: "4d4 × 10 po y compras" },creation.equipment.method)}<div class="builder-grid">${select("wizardWeapon","Arma",{ quarterstaff: "Bastón", dagger: "Daga" },creation.wizardWeapon)}${select("wizardFocus","Componentes",{ "component-pouch": "Bolsa de componentes", crystal: "Cristal", orb: "Orbe", rod: "Vara", staff: "Bastón arcano", wand: "Varita" },creation.wizardFocus)}${select("wizardPack","Paquete",{ scholar: "Erudito", explorer: "Explorador" },creation.wizardPack)}${BACKGROUND_EQUIPMENT[creation.background.equipment].choices.map((c,i) => select(`backgroundEquipment${i}`,c.label,Object.fromEntries(c.keys.map((key) => [key,PHB_EQUIPMENT[key]?.name ?? "Mula y carro"])),creation.background.selections[i] ?? c.keys[0]!)).join("")}</div><p>Se añaden el libro de conjuros, el equipo de trasfondo y su dinero. El foco no sustituye componentes con precio ni componentes consumidos. Los rituales requieren disponer del libro.</p>`;
      if (creation.equipment.method === "gold") return `<h3>Comprá tu equipo inicial</h3>${select("equipmentMethod", "Método de equipo", { packages: "Paquetes de clase y trasfondo", gold: `${builderClassProfile(creation.classKey).goldDice}d4${creation.classKey === "monk" ? "" : " × 10"} po y compras` }, creation.equipment.method)}<p>Esta alternativa sustituye ambos paquetes y el dinero de trasfondo.</p><div class="builder-grid">${creation.equipment.goldRoll.map((n,i) => input(`goldDie${i}`, `d4 ${i+1}`, String(n), 'type="number" min="1" max="4"')).join("")}<button type="button" data-builder-gold-roll>Tirar ${builderClassProfile(creation.classKey).goldDice}d4</button></div><p data-builder-gold-budget>Disponibles: ${creation.equipment.goldRoll.reduce((a,b) => a+b,0)*builderGoldMultiplier(creation.classKey)} po. Gastadas: ${creation.equipment.purchases.reduce((n,p) => n+equipmentGoldCost(p.key)*p.quantity,0).toFixed(2)} po.</p><div class="builder-grid">${select("purchaseKey", "Objeto del catálogo", Object.fromEntries(Object.entries(PHB_PURCHASABLE_EQUIPMENT).map(([key,item]) => [key,`${item.name} · ${equipmentGoldCost(key).toFixed(2)} po`])), purchaseKey)}${input("purchaseQuantity", "Cantidad", String(purchaseQuantity), 'type="number" min="1" max="100"')}<button type="button" data-builder-add-purchase>Añadir compra</button></div>${creation.equipment.purchases.map((p,i) => `<div class="builder-grid"><strong>${html(PHB_EQUIPMENT[p.key]!.name)}</strong>${input(`purchaseQty${i}`, "Cantidad", String(p.quantity), 'type="number" min="1" max="100"')}<label><input type="checkbox" name="purchaseEquip${i}" ${p.equipped ? "checked" : ""}> Equipar una unidad</label><button type="button" data-builder-remove-purchase="${i}">Quitar</button></div>`).join("")}`;
      return `<h3>Prepará tu equipo</h3>${select("equipmentMethod", "Método de equipo", { packages: "Paquetes de clase y trasfondo", gold: `${builderClassProfile(creation.classKey).goldDice}d4${creation.classKey === "monk" ? "" : " × 10"} po y compras` }, creation.equipment.method)}<p>Se añadirán el equipo y dinero de clase y trasfondo.</p>
        <div class="builder-grid">${select("armor", "Armadura", { "chain-mail": "Cota de malla", leather: "Cuero, arco largo y 20 flechas" }, creation.equipment.armor)}${select("primary", "Arma marcial", weapons, creation.equipment.primary)}
        ${select("shield", "Segunda elección", { yes: "Escudo", no: "Segunda arma marcial" }, creation.equipment.shield ? "yes" : "no")}
        ${!creation.equipment.shield ? select("secondary", "Segunda arma", weapons, creation.equipment.secondary) : ""}
        ${select("backup", "Armas adicionales", { crossbow: "Ballesta ligera y 20 virotes", handaxes: "Dos hachas de mano" }, creation.equipment.backup)}
        ${select("pack", "Paquete", { explorer: "Explorador", dungeoneer: "Explorador de mazmorras" }, creation.equipment.pack)}
        ${creation.background.equipment === "acolyte" ? select("prayerItem", "Objeto de oración del acólito", { "prayer-book": "Libro de plegarias", "prayer-wheel": "Rueda de plegarias" }, creation.background.prayerItem ?? "prayer-book") : ""}
        ${creation.background.equipment === "soldier" ? select("gamingSet", "Juego del soldado", { dice: "Juego de dados", cards: "Baraja de cartas" }, creation.background.gamingSet ?? "dice") : ""}</div>
        <div class="builder-grid">${!["acolyte","soldier"].includes(creation.background.equipment) ? BACKGROUND_EQUIPMENT[creation.background.equipment].choices.map((choice,i) => select(`backgroundEquipment${i}`, choice.label, Object.fromEntries(choice.keys.map((key) => [key,PHB_EQUIPMENT[key]?.name ?? "Mula y carro"])), creation.background.selections[i] ?? choice.keys[0]!)).join("") : ""}</div>
        <p class="builder-help">Un escudo no se equipa automáticamente junto a un arma a dos manos. Podés cambiar el equipo durante la partida.</p>`;
    }
    return "";
  }

  function read(form: HTMLFormElement): void {
    const data = new FormData(form);
    form.querySelectorAll<HTMLSelectElement>("select[name]").forEach((control) => { if (!data.has(control.name) && !control.disabled) data.set(control.name,control.value); });
    const text = (name: string) => String(data.get(name) ?? "");
    const has = (name: string) => data.has(name);
    if (has("classKey") && text("classKey") !== creation.classKey) {
      const selectedClass = text("classKey") as FighterCreation["classKey"];
      const template = builderClassProfile(selectedClass).defaults(creation.name);
      creation.classKey = template.classKey; creation.baseAbilities = template.baseAbilities; creation.skills = [...template.skills]; creation.wizard = template.wizard; creation.warlock = template.warlock; creation.cleric = template.cleric; creation.rogue = template.rogue; creation.barbarian = template.barbarian; creation.bard = template.bard; creation.druid = template.druid; creation.ranger = template.ranger; creation.sorcerer = template.sorcerer; creation.monk = template.monk; creation.paladin = template.paladin; creation.equipment.goldRoll = template.equipment.goldRoll; initialLevels = [];
    }
    if (character || step >= 4 && step < stages.length-1) {
      if (character) choice = readLevelFields(data, choice, levelContext!.builder!);
      else initialLevels[step-4] = readLevelFields(data, initialLevels[step-4]!, levelContext!.builder!);
    } else {
      if (has("name")) { creation.name = text("name"); creation.playerName = text("playerName"); creation.personality = text("personality"); creation.startingLevel = Math.max(1,Math.min(20,Number(text("startingLevel")) || 1)); creation.allowFeats = text("allowFeats") === "yes"; creation.alignment = text("alignment"); creation.appearance = text("appearance"); creation.personalTraits = [text("personalTrait0"),text("personalTrait1")].filter(Boolean); creation.ideal = text("ideal"); creation.bond = text("bond"); creation.flaw = text("flaw"); }
      if (has("race")) {
        const changed = text("race") !== creation.race;
        creation.race = text("race") as FighterCreation["race"];
        if (!["half-orc","high-elf","wood-elf","drow"].includes(creation.race)) creation.racialSkillReplacement = null;
        if (changed) { creation.origin = { abilities: ["human-variant","half-elf"].includes(creation.race) ? ["strength","dexterity"] : [], skills: creation.race === "half-elf" ? ["arcana","deception"] : creation.race === "human-variant" ? ["stealth"] : [], cantrip: "", ancestry: null }; creation.initialFeat = null; }
        if (has("ancestry")) creation.origin.ancestry = (text("ancestry") || null) as FighterCreation["origin"]["ancestry"];
        creation.languages = ["human","human-variant","high-elf","half-elf"].includes(creation.race) ? [changed ? "Goblin" : text("raceLanguage")] : [];
        creation.dwarfTool = creation.race.includes("dwarf") ? (changed ? "smith" : text("dwarfTool") as NonNullable<FighterCreation["dwarfTool"]>) : null;
      }
      if (has("abilityMethod")) { creation.abilityMethod = text("abilityMethod") as FighterCreation["abilityMethod"]; for (const ability of BUILDER_ABILITIES) creation.baseAbilities[ability] = Number(text(`ability_${ability}`)); }
      if (has("originAbility0")) creation.origin.abilities = [text("originAbility0"),text("originAbility1")] as FighterCreation["origin"]["abilities"];
      if (has("skill0")) {
        if (has("style")) creation.style = text("style") as FighterCreation["style"];
        creation.skills = Array.from({ length: creation.classKey === "rogue" ? 4 : ["bard","ranger"].includes(creation.classKey) ? 3 : 2 },(_,i) => text(`skill${i}`)) as SkillKey[];
        if (text("backgroundPreset") !== creation.background.equipment) creation.background = structuredClone(BACKGROUND_PRESETS[text("backgroundPreset") as FighterCreation["background"]["equipment"]]);
        else creation.background = { ...creation.background, name: text("backgroundName"), skills: [text("backgroundSkill0"), text("backgroundSkill1")] as SkillKey[], tools: list(text("backgroundTools")), languages: list(text("backgroundLanguages")), featureName: text("featureName"), featureDescription: text("featureDescription") };
        creation.racialSkillReplacement = ["half-orc","high-elf","wood-elf","drow"].includes(creation.race) && [...creation.skills, ...creation.background.skills].includes(creation.race === "half-orc" ? "intimidation" : "perception") ? (has("racialSkillReplacement") ? text("racialSkillReplacement") || null : creation.racialSkillReplacement) as SkillKey | null : null;
      }
      if (has("originSkill0")) creation.origin.skills = [text("originSkill0"), ...(has("originSkill1") ? [text("originSkill1")] : [])] as SkillKey[];
      if (has("originCantrip")) creation.origin.cantrip = text("originCantrip");
      if (has("initialFeatKey")) creation.initialFeat = readFeat("initialFeat", data, creation.initialFeat);
      if (["monk","paladin"].includes(creation.classKey)) readMartialInitial(data,creation);
      if (creation.classKey === "sorcerer") readSorcererInitial(data,creation);
      if (creation.classKey === "ranger") readRangerInitial(data,creation);
      if (creation.classKey === "druid") readDruidInitial(data,creation);
      if (creation.classKey === "bard") readBardInitial(data,creation);
      if (creation.classKey === "barbarian") readBarbarianInitial(data,creation);
      if (creation.classKey === "rogue") readRogueInitial(data,creation);
      if (creation.classKey === "cleric") readClericInitial(data,creation);
      if (creation.classKey === "wizard") readWizardInitial(data,creation);
      if (creation.classKey === "warlock") { readWarlockInitial(data,creation); if (has("warlockPrimary")) { creation.warlockPrimary = text("warlockPrimary"); creation.warlockSecondary = text("warlockSecondary"); creation.warlockPack = text("warlockPack") as FighterCreation["warlockPack"]; creation.wizardFocus = text("wizardFocus") as FighterCreation["wizardFocus"]; } }
      if (has("wizardWeapon")) { creation.wizardWeapon = text("wizardWeapon") as FighterCreation["wizardWeapon"]; creation.wizardFocus = text("wizardFocus") as FighterCreation["wizardFocus"]; creation.wizardPack = text("wizardPack") as FighterCreation["wizardPack"]; }
      if (has("equipmentMethod")) creation.equipment.method = text("equipmentMethod") as "packages" | "gold";
      if (has("purchaseKey")) { purchaseKey = text("purchaseKey"); purchaseQuantity = Number(text("purchaseQuantity")); }
      if (has("goldDie0")) creation.equipment.goldRoll = Array.from({ length: builderClassProfile(creation.classKey).goldDice }, (_,i) => i).map((i) => Number(text(`goldDie${i}`)));
      creation.equipment.purchases.forEach((p,i) => { if (has(`purchaseQty${i}`)) { p.quantity = Number(text(`purchaseQty${i}`)); p.equipped = has(`purchaseEquip${i}`); } });
      if (has("backgroundEquipment0")) creation.background.selections = BACKGROUND_EQUIPMENT[creation.background.equipment].choices.map((_,i) => text(`backgroundEquipment${i}`));
      if (has("armor")) creation.equipment = { ...creation.equipment, armor: text("armor") as FighterCreation["equipment"]["armor"], primary: text("primary"), shield: text("shield") === "yes", secondary: text("shield") === "yes" ? null : text("secondary") || "shortsword", backup: text("backup") as FighterCreation["equipment"]["backup"], pack: text("pack") as FighterCreation["equipment"]["pack"] };
      if (has("prayerItem")) creation.background.prayerItem = text("prayerItem") as FighterCreation["background"]["prayerItem"];
      if (has("gamingSet")) creation.background.gamingSet = text("gamingSet") as FighterCreation["background"]["gamingSet"];
    }
    save();
  }

  async function preview(): Promise<CharacterV2> {
    return character ? advanceGuidedCharacter(character, choice, new Date().toISOString()) : buildGuidedCharacter("chr_00000000000000000000000000000000", operationId, creation, new Date().toISOString(), initialLevels.slice(0, creation.startingLevel-1));
  }
  async function render(focusName?: string): Promise<void> {
    const token = ++generation;
    stages = stageNames();
    if (!character) {
      const levels = await Promise.all(Array.from({ length: creation.startingLevel-1 }, async (_, i) => initialLevels.find((s) => s.level === i+2) ?? FighterLevelChoiceSchema.parse({ operationId: await createDeterministicId("build", operationId, `level-${i+2}`), level: i+2, hpMethod: "fixed", hpBase: builderClassProfile(creation.classKey).fixedHp, abilityIncrease: builderClassProfile(creation.classKey).asi.includes(i+2) ? { ...zero, [builderClassProfile(creation.classKey).ability]: 2 } : null, subclass: null, additionalStyle: null })));
      if (token !== generation || !dialog.isConnected) return;
      initialLevels = levels;
      step = Math.min(step, stages.length-1);
      if (step >= 4 && step < stages.length-1) {
        const selectedLevel = step-2;
        try {
          levelContext = await buildGuidedCharacter("chr_00000000000000000000000000000000", operationId, { ...creation, startingLevel: 1 }, new Date().toISOString());
        } catch (failure) {
          step = 2;
          error = failure instanceof Error ? failure.message : "Revisá el origen del personaje.";
        }
        if (step >= 4) for (let i = 0; i < selectedLevel-2; i++) {
          try { levelContext = await advanceGuidedCharacter(levelContext!, initialLevels[i]!, new Date().toISOString()); }
          catch (failure) {
            step = i+4;
            error = failure instanceof Error ? failure.message : "Revisá las elecciones de este nivel.";
            break;
          }
        }
      }
    }
    if (token !== generation || !dialog.isConnected) return;
    let content = body();
    if (step === stages.length - 1) {
      try {
        const built = await preview();
        content = `<h3>${html(built.name)} · ${html(built.identity.className)} ${built.identity.level}${built.identity.subclass ? ` · ${html(built.identity.subclass)}` : ""}</h3>
          <div class="builder-summary"><div>PG máximos<strong>${built.combat.hitPoints.maximum}${character ? ` (+${built.combat.hitPoints.maximum-character.combat.hitPoints.maximum})` : ""}</strong></div><div>CA<strong>${built.combat.armorClass}</strong></div><div>Dados de golpe<strong>${built.combat.hitDice.formula}</strong></div></div>
          <p>${html(built.identity.species)} ${html(built.identity.subrace)} · ${html(built.identity.background)}</p>
          <div class="builder-grid">${BUILDER_ABILITIES.map((ability) => `<div>${SAVE_DEFINITIONS[ability].label}: <strong>${built.abilities[ability]}</strong></div>`).join("")}</div>
          <p>Competencias: ${Object.entries(built.checks.skills).filter(([,state]) => state.proficiency > 0).map(([key]) => SKILL_DEFINITIONS[key as SkillKey].label).join(", ")}.</p>
          <h4>${character ? "Rasgos de clase tras el ascenso" : "Rasgos"}</h4><ul>${built.traits.filter((group) => !character || group.title.startsWith(character.identity.className)).flatMap((group) => group.traits.map((trait) => `<li>${html(trait.name)}</li>`)).join("")}</ul>
          ${!character ? `<h4>Inventario y acciones</h4><p>${built.inventory.map((item) => `${html(item.name)}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(" · ")}</p><p>${built.currency.gold} po iniciales.</p>` : `<p>PG actuales: ${character.combat.hitPoints.current} → ${built.combat.hitPoints.current}. Se conservan condiciones y recursos gastados.</p>`}
          ${built.spellcasting.spells.length ? `<h4>Conjuros</h4><p>${built.spellcasting.spells.map((spell) => html(spell.name)).join(" · ")}</p>` : ""}
          ${built.builder?.classKey === "wizard" && !built.spellcasting.wizard?.bookAvailable ? '<p class="builder-help">Tu compra inicial no incluye libro de conjuros. Conservás la preparación inicial, pero necesitás conseguir un libro y reconstruirlo o copiar los conjuros antes de cambiar la preparación o realizar rituales del libro.</p>' : ""}
          <p class="builder-help">Resistencias, críticos, repeticiones de dados y activaciones condicionales están registrados como rasgos para resolver durante el juego. ${built.builder?.classKey === "warlock" ? "Magia de pacto, invocaciones y Arcanos se administran desde los recursos de Brujo. Efectos sobre objetivos y componentes se resuelven en la mesa." : built.builder?.classKey === "wizard" ? "Libro, preparación, espacios y recursos de escuela se administran desde Libro y recursos de Mago. Objetivos, componentes y efectos sobre otras criaturas se resuelven en la mesa." : "Arquería, Defensa, Duelo y Atleta notable se calculan en sus situaciones admitidas."}</p>`;
      } catch (failure) { error = failure instanceof Error ? failure.message : "Revisá tus elecciones."; content = "<p>Volvé al paso anterior para resolver las elecciones pendientes.</p>"; }
    }
    if (token !== generation || !dialog.isConnected) return;
    dropdowns?.dispose();
    dialog.innerHTML = `<form class="character-builder-form"><header><div><p class="builder-eyebrow">D&D 5e · 2014</p><h2 id="character-builder-title">${character ? "Subir de nivel" : "Crear personaje"}</h2></div><button type="button" data-builder-close ${busy ? "disabled" : ""}>Guardar y cerrar</button></header>
      <nav aria-label="Pasos del asistente"><ol>${navigationItems()}</ol></nav>
      ${resumed ? '<p class="builder-help">Retomaste un borrador guardado.</p>' : ""}
      <div class="builder-content">${content}</div><p class="builder-error" role="alert">${html(error)}</p>
      <footer><small>${stored ? "Borrador guardado en este dispositivo." : "El borrador se conserva al escribir si el almacenamiento está disponible."}</small><div>
        <button type="button" data-builder-discard ${busy ? "disabled" : ""}>Descartar</button>
        ${step > 0 ? `<button type="button" data-builder-back ${busy ? "disabled" : ""}>Atrás</button>` : ""}
        <button type="submit" ${busy || step === stages.length-1 && Boolean(error) ? "disabled" : ""}>${busy ? "Guardando…" : step === stages.length-1 ? character ? "Confirmar nivel" : "Crear personaje" : "Continuar"}</button></div></footer></form>`;
    const form = dialog.querySelector<HTMLFormElement>("form")!;
    // Restore values explicitly after rebuilding a step, including resumed drafts.
    form.querySelectorAll<HTMLSelectElement>("select").forEach((control) => {
      const selected = control.querySelector<HTMLOptionElement>("option[selected]");
      if (selected) control.value = selected.value;
    });
    form.addEventListener("input", (event) => { if (!busy && !(event.target instanceof HTMLSelectElement)) read(form); });
    form.addEventListener("change", (event) => {
      if (busy) return;
      read(form); error = "";
      const target = event.target;
      // Text/number change fires on blur, before the next control opens. Replacing
      // the form here destroys that dropdown and returns focus to the old input.
      // Only selection controls rebuild dependent choices after a committed choice.
      if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement && ["checkbox","radio"].includes(target.type)) {
        void render(target.name);
      } else {
        const alert = dialog.querySelector<HTMLElement>('[role="alert"]');
        if (alert) alert.textContent = "";
        form.querySelectorAll<HTMLElement>("[data-builder-ability-total]").forEach((readout) => {
          const ability = readout.dataset.builderAbilityTotal as typeof BUILDER_ABILITIES[number];
          const racial = BUILDER_RACES[creation.race].bonuses as Partial<FighterCreation["baseAbilities"]>;
          readout.textContent = `${SAVE_DEFINITIONS[ability].label} con raza: ${creation.baseAbilities[ability] + (racial[ability] ?? 0) + creation.origin.abilities.filter((a) => a === ability).length}`;
        });
        const budget = form.querySelector<HTMLElement>("[data-builder-gold-budget]");
        if (budget) budget.textContent = `Disponibles: ${creation.equipment.goldRoll.reduce((a,b) => a+b,0)*builderGoldMultiplier(creation.classKey)} po. Gastadas: ${creation.equipment.purchases.reduce((n,p) => n+equipmentGoldCost(p.key)*p.quantity,0).toFixed(2)} po.`;
        if (target instanceof HTMLInputElement && target.name === "startingLevel") {
          stages = stageNames();
          dialog.querySelector("nav ol")!.innerHTML = navigationItems();
          bindNavigation(form);
        }
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); if (busy) return;
      read(form); error = "";
      try {
        if (step < stages.length-1) {
          if (character) await preview();
          else if (step === 0 && !creation.name.trim()) throw new Error("Ingresá el nombre del personaje.");
          else if (step === 0 && creation.classKey === "warlock" && !creation.warlock.patron) throw new Error("Elegí tu patrón de Brujo.");
          else if (step === 1) validateFighterAbilities(creation);
          else if (step === 2 || step === 3) validateGuidedCreation(creation);
          else if (step >= 4) await advanceGuidedCharacter(levelContext!, initialLevels[step-4]!, new Date().toISOString());
          step++; save(); await render(); dialog.scrollTop = 0;
        } else {
          busy = true; await preview(); await render();
          if (character) await options.onAdvance(choice); else await options.onCreate(operationId, creation, initialLevels.slice(0, creation.startingLevel-1));
          try { localStorage.removeItem(key); } catch { /* Successful campaign save remains successful. */ }
          busy = false; dialog.close();
        }
      } catch (failure) { busy = false; error = failure instanceof Error ? failure.message : "No se pudo guardar. El borrador sigue disponible."; await render(); }
    });
    dialog.querySelector("[data-builder-close]")?.addEventListener("click", close);
    dialog.querySelector("[data-builder-discard]")?.addEventListener("click", () => { if (busy) return; try { localStorage.removeItem(key); } catch {} dialog.close(); });
    dialog.querySelector("[data-builder-back]")?.addEventListener("click", () => { read(form); step--; error = ""; save(); void render(); });
    bindNavigation(form);
    dialog.querySelector<HTMLButtonElement>("[data-builder-roll]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
      const page = step, selected = character ? choice : initialLevels[step-4]!;
      try {
        const result = await options.diceRoller.roll({ name: `PG del nuevo nivel de ${builderClassProfile(creation.classKey).name.toLowerCase()}`, expressions: [`1d${builderClassProfile(creation.classKey).die}`], mode: "normal" });
        const current = character ? choice : initialLevels[page-4];
        if (!dialog.isConnected || step !== page || current?.operationId !== selected.operationId || current.hpMethod !== "rolled") return;
        if (result.kind !== "rolled" || result.totals.length !== 1) throw new Error(`La tirada se envió a TaleSpire. Ingresá el resultado del d${builderClassProfile(creation.classKey).die} cuando aparezca.`);
        if (!Number.isInteger(result.totals[0]) || result.totals[0]! < 1 || result.totals[0]! > (builderClassProfile(creation.classKey).die)) throw new Error("El resultado del dado de golpe no es válido.");
        current.hpBase = result.totals[0]!; save(); error = "";
      } catch (failure) { error = failure instanceof Error ? failure.message : "No se pudo obtener la tirada."; }
      if (dialog.isConnected) await render();
    });
    dialog.querySelectorAll<HTMLButtonElement>("[data-builder-ability-roll]").forEach((button) => button.addEventListener("click", async () => {
      const ability = button.dataset.builderAbilityRoll as typeof BUILDER_ABILITIES[number]; button.disabled = true;
      try {
        const result = await options.diceRoller.roll({ name: `Atributo ${ability}: 4d6, descartando el menor`, expressions: ["1d6","1d6","1d6","1d6"], mode: "normal" });
        if (!dialog.isConnected || step !== 1 || creation.abilityMethod !== "rolled") return;
        if (result.kind !== "rolled" || result.totals.length !== 4 || result.totals.some((n) => !Number.isInteger(n) || n < 1 || n > 6)) throw new Error("Ingresá el resultado de sumar los tres dados mayores de la tirada enviada a TaleSpire.");
        creation.baseAbilities[ability] = [...result.totals].sort((a,b) => b-a).slice(0,3).reduce((a,b) => a+b,0); save(); error = "";
      } catch (failure) { error = failure instanceof Error ? failure.message : "No se pudo obtener la tirada."; }
      if (dialog.isConnected) await render();
    }));
    dialog.querySelector<HTMLButtonElement>("[data-builder-gold-roll]")?.addEventListener("click", async () => {
      try {
        const result = await options.diceRoller.roll({ name: `Oro inicial: ${builderClassProfile(creation.classKey).goldDice}d4 × 10`, expressions: Array(builderClassProfile(creation.classKey).goldDice).fill("1d4"), mode: "normal" });
        if (!dialog.isConnected || step !== 3 || creation.equipment.method !== "gold") return;
        if (result.kind !== "rolled" || result.totals.length !== (builderClassProfile(creation.classKey).goldDice) || result.totals.some((n) => !Number.isInteger(n) || n < 1 || n > 4)) throw new Error("Ingresá los resultados de d4 de la tirada enviada a TaleSpire.");
        creation.equipment.goldRoll = result.totals; save(); error = "";
      } catch (failure) { error = failure instanceof Error ? failure.message : "No se pudo obtener la tirada."; }
      if (dialog.isConnected) await render();
    });
    dialog.querySelector<HTMLButtonElement>("[data-builder-add-purchase]")?.addEventListener("click", () => {
      const data = new FormData(form), key = String(data.get("purchaseKey")), quantity = Number(data.get("purchaseQuantity"));
      if (!PHB_PURCHASABLE_EQUIPMENT[key] || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) { error = "Elegí un objeto y una cantidad de 1 a 100."; void render(); return; }
      const existing = creation.equipment.purchases.find((p) => p.key === key);
      if (existing) existing.quantity += quantity; else creation.equipment.purchases.push({ key, quantity, equipped: false });
      save(); void render();
    });
    dialog.querySelectorAll<HTMLButtonElement>("[data-builder-remove-purchase]").forEach((button) => button.addEventListener("click", () => { creation.equipment.purchases.splice(Number(button.dataset.builderRemovePurchase),1); save(); void render(); }));
    applyBuilderAvailability(form,creation,levelContext,character || step >= 4 ? (character ? choice : initialLevels[step-4] ?? null) : null);
    dropdowns = bindDialogSelects(dialog);
    if (focusName) {
      const control = form.querySelector<HTMLElement>(`[name="${focusName}"]`);
      if (control instanceof HTMLSelectElement) dropdowns.focus(control);
      else control?.focus();
    }
  }
  document.body.append(dialog);
  dialog.showModal();
  await render();
}
