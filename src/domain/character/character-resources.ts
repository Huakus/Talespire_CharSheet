import { martialConditionImmune,martialResourceEffects } from "./martial-play";
import { sorcererResourceEffects } from "./sorcerer-play";
import { resetRangerAfterRest } from "./ranger-play";
import { endBarbarianRage,barbarianMindlessRage } from "./barbarian-rules";
import { druidShapeActive,druidFormDamage,elapseDruidHours } from "./druid-rules";
import { druidCircle } from "./druid-catalog";
import { applyBarbarianResourceEffects } from "./barbarian-play";
import { elapseRogueHours } from "./rogue-play";
import { z } from "zod";
import {
  CharacterV2Schema,
  IsoTimestampSchema,
  StableIdSchema,
  type CharacterV2,
} from "./character-v2";
import { resetInventoryItemResources } from "./character-inventory";
import { CharacterRevisionConflictError } from "./edit-character";
import { resetTraitsByRest } from "./character-content";
import { resetWizardAfterRest } from "./wizard-play";
import { pactSlots } from "./warlock-catalog";
import { abilityModifier,projectAbilityScore } from "./character-projection";
import {
  adjustCurrency,
  CurrencyDenominationSchema,
} from "./character-currency";

const PositiveAmountSchema = z.number().int().positive();

export const CharacterResourceCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("damage"), amount: PositiveAmountSchema }),
  z.object({ kind: z.literal("heal"), amount: PositiveAmountSchema }),
  z.object({
    kind: z.literal("grant-temporary-hit-points"),
    amount: PositiveAmountSchema,
  }),
  z.object({
    kind: z.literal("set-death-saves"),
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  z.object({ kind: z.literal("toggle-inspiration") }),
  z.object({
    kind: z.literal("set-exhaustion"),
    level: z.number().int().min(0).max(6),
  }),
  z.object({
    kind: z.literal("spend-hit-dice"),
    dice: PositiveAmountSchema,
    healing: z.number().int().nonnegative(),
  }),
  z.object({ kind: z.literal("long-rest") }),
  z.object({ kind: z.literal("short-rest") }),
  z.object({
    kind: z.literal("adjust-currency"),
    denomination: CurrencyDenominationSchema,
    quantity: z.number().int().refine((value) => value !== 0),
  }),
  z.object({
    kind: z.literal("add-condition"),
    conditionId: StableIdSchema,
    key: z.string().min(1),
    label: z.string().min(1),
    level: z.number().int().positive().nullable(),
    addedAt: IsoTimestampSchema,
  }),
  z.object({
    kind: z.literal("remove-condition"),
    conditionId: StableIdSchema,
  }),
]);

export type CharacterResourceCommand = z.infer<
  typeof CharacterResourceCommandSchema
>;

export class InsufficientHitDiceError extends Error {
  constructor(readonly requested: number, readonly available: number) {
    super(`Cannot spend ${requested} hit dice; only ${available} remain`);
    this.name = "InsufficientHitDiceError";
  }
}

export interface ResourceCommandEffects {
  concentrationCheckDc: number | null;
  hitPointsChangedBy: number;
  temporaryHitPointsChangedBy: number;
  hitDiceRecovered: number;
  deferredResets: ("spell-slots" | "traits")[];
}

export interface ApplyResourceCommandOptions {
  expectedRevision: number;
  updatedAt: string;
}

export interface ResourceCommandResult {
  character: CharacterV2;
  effects: ResourceCommandEffects;
}

export function applyCharacterResourceCommand(
  input: CharacterV2,
  commandInput: CharacterResourceCommand,
  options: ApplyResourceCommandOptions,
): ResourceCommandResult {
  const character = CharacterV2Schema.parse(input);
  const command = CharacterResourceCommandSchema.parse(commandInput);
  const updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (character.revision !== options.expectedRevision) {
    throw new CharacterRevisionConflictError(
      options.expectedRevision,
      character.revision,
    );
  }

  if (["short-rest","long-rest"].includes(command.kind)) endBarbarianRage(character);
  if (druidShapeActive(character) && command.kind === "spend-hit-dice") throw new Error("En Forma Salvaje usás los Dados de Golpe de la criatura. Registrá su curación con Curar y sus dados en el bloque de la forma, o revertí para gastar los de la ficha base.");
  if (command.kind === "add-condition" && command.key === "poisoned" && character.builder?.classKey === "druid" && druidCircle(character.builder) === "land" && character.identity.level >= 10) throw new Error("Protección de la Naturaleza te hace inmune al veneno.");
  if (command.kind === "add-condition" && character.builder?.classKey === "barbarian" && command.key === "raging") throw new Error("Inici\u00e1 Furia desde el panel de B\u00e1rbaro para gestionar sus usos.");
  if (command.kind === "add-condition" && barbarianMindlessRage(character) && ["frightened","charmed"].includes(command.key)) throw new Error("Furia Inconsciente te hace inmune a ese estado durante la furia.");
  const combat = structuredClone(character.combat);
  let inventory = character.inventory;
  let spellcasting = character.spellcasting;
  let traits = character.traits;
  let currency = character.currency;
  const effects: ResourceCommandEffects = {
    concentrationCheckDc: null,
    hitPointsChangedBy: 0,
    temporaryHitPointsChangedBy: 0,
    hitDiceRecovered: 0,
    deferredResets: [],
  };

  switch (command.kind) {
    case "damage": {
      const absorbed = Math.min(combat.hitPoints.temporary, command.amount);
      const remainingDamage = druidFormDamage(character,command.amount - absorbed);
      const previousHp = combat.hitPoints.current;
      combat.hitPoints.temporary -= absorbed;
      combat.hitPoints.current = Math.max(0, previousHp - remainingDamage);
      effects.temporaryHitPointsChangedBy = -absorbed;
      effects.hitPointsChangedBy = combat.hitPoints.current - previousHp;
      const focusedConjuration = character.builder?.classKey === "wizard" && character.identity.level >= 10 && character.builder.levels.find((step) => step.level === 2)?.subclass === "conjuration" && character.spellcasting.wizard?.concentrationSchool === "Conjuración";
      if (combat.hitPoints.current === 0) combat.conditions = combat.conditions.filter((condition) => condition.key !== "concentration");
      else if (!focusedConjuration && combat.conditions.some((condition) => condition.key === "concentration")) {
        effects.concentrationCheckDc = Math.max(10, Math.floor(command.amount / 2));
      }
      break;
    }
    case "heal": {
      if (character.spellcasting.druid?.form) {
        const form = character.spellcasting.druid.form;form.currentHp = Math.min(form.maximumHp,form.currentHp+command.amount);break;
      }
      const previousHp = combat.hitPoints.current;
      combat.hitPoints.current = Math.min(
        combat.hitPoints.maximum,
        previousHp + command.amount,
      );
      effects.hitPointsChangedBy = combat.hitPoints.current - previousHp;
      if (combat.hitPoints.current > 0) {
        combat.deathSaves = { successes: 0, failures: 0 };
      }
      break;
    }
    case "grant-temporary-hit-points": {
      const previous = combat.hitPoints.temporary;
      combat.hitPoints.temporary = Math.max(previous, command.amount);
      effects.temporaryHitPointsChangedBy = combat.hitPoints.temporary - previous;
      break;
    }
    case "set-death-saves":
      combat.deathSaves = {
        successes: command.successes,
        failures: command.failures,
      };
      break;
    case "toggle-inspiration":
      combat.inspiration = !combat.inspiration;
      break;
    case "set-exhaustion":
      combat.exhaustion = command.level;
      break;
    case "spend-hit-dice": {
      if (command.dice > combat.hitDice.remaining) {
        throw new InsufficientHitDiceError(
          command.dice,
          combat.hitDice.remaining,
        );
      }
      combat.hitDice.remaining -= command.dice;
      combat.hitDice.current = String(combat.hitDice.remaining);
      const previousHp = combat.hitPoints.current;
      combat.hitPoints.current = Math.min(
        combat.hitPoints.maximum,
        previousHp + command.healing,
      );
      effects.hitPointsChangedBy = combat.hitPoints.current - previousHp;
      break;
    }
    case "long-rest": {
      elapseDruidHours(character,8);
      const previousHp = combat.hitPoints.current;
      const previousTemporary = combat.hitPoints.temporary;
      const previousDice = combat.hitDice.remaining;
      const restingForm = character.spellcasting.druid?.form;
      const recoveredDice = restingForm ? 0 : Math.max(Math.floor(combat.hitDice.maximum / 2), 1);
      if (restingForm) restingForm.currentHp = restingForm.maximumHp;
      else combat.hitPoints.current = combat.hitPoints.maximum;
      combat.hitPoints.temporary = 0;
      combat.deathSaves = { successes: 0, failures: 0 };
      combat.exhaustion = Math.max(0, combat.exhaustion - 1);
      combat.hitDice.remaining = Math.min(
        combat.hitDice.maximum,
        previousDice + recoveredDice,
      );
      combat.hitDice.current = String(combat.hitDice.remaining);
      effects.hitPointsChangedBy = combat.hitPoints.current - previousHp;
      effects.temporaryHitPointsChangedBy = -previousTemporary;
      effects.hitDiceRecovered = combat.hitDice.remaining - previousDice;
      inventory = character.inventory.map((item) => resetInventoryItemResources(item, "long-rest"));
      spellcasting = {
        ...character.spellcasting,
        slots: Object.fromEntries(
          Object.entries(character.spellcasting.slots).map(([level, state]) => [
            level,
            { ...state, used: 0 },
          ]),
        ),
      };
      traits = resetTraitsByRest(character, "long-rest");
      elapseRogueHours(character,8); spellcasting.spells = character.spellcasting.spells;
      resetWizardAfterRest(character,"long-rest");
      effects.deferredResets = [];
      break;
    }
    case "short-rest": {
      elapseDruidHours(character,1);
      if (character.builder?.classKey === "warlock") spellcasting = { ...character.spellcasting,slots: Object.fromEntries(Object.entries(character.spellcasting.slots).map(([level,state]) => [level,{ ...state,used: Number(level) === pactSlots(character.identity.level).level ? 0 : state.used }])) };
      inventory = character.inventory.map((item) => resetInventoryItemResources(item, "short-rest"));
      traits = resetTraitsByRest(character, "short-rest");
      elapseRogueHours(character,1); spellcasting.spells = character.spellcasting.spells;
      resetWizardAfterRest(character,"short-rest");
      break;
    }
    case "adjust-currency":
      currency = adjustCurrency(currency, command.denomination, command.quantity);
      break;
    case "add-condition":
      if (martialConditionImmune(character,command.key)) throw new Error("Tu clase te hace inmune a esta condición mientras se cumplen sus requisitos.");
      combat.conditions = [
        ...combat.conditions.filter((condition) => condition.key !== command.key),
        {
          id: command.conditionId,
          key: command.key,
          label: command.label,
          level: command.level,
          addedAt: command.addedAt,
        },
      ];
      break;
    case "remove-condition":
      combat.conditions = combat.conditions.filter(
        (condition) => condition.id !== command.conditionId,
      );
      break;
  }

  if (["short-rest","long-rest"].includes(command.kind) && character.builder?.classKey === "warlock" && character.builder.creation.warlock.patron === "celestial" && character.identity.level >= 10) {
    const before = combat.hitPoints.temporary;
    combat.hitPoints.temporary = Math.max(before,character.identity.level+abilityModifier(projectAbilityScore(character,"charisma")));
    effects.temporaryHitPointsChangedBy += combat.hitPoints.temporary-before;
  }
  if (command.kind === "short-rest" || command.kind === "long-rest") resetRangerAfterRest(character,command.kind);
  if (character.spellcasting.wizard && combat.conditions.some((condition) => ["incapacitated", "unconscious", "stunned", "paralyzed", "petrified"].includes(condition.key))) character.spellcasting.wizard.thirdEye = null;
  if (character.spellcasting.wizard && !combat.conditions.some((condition) => condition.key === "concentration")) character.spellcasting.wizard.concentrationSchool = null;
  if (character.spellcasting.druid && combat.conditions.some((p) => ["unconscious","dead"].includes(p.key))) character.spellcasting.druid.form = null;

  return {
    character: martialResourceEffects(sorcererResourceEffects(applyBarbarianResourceEffects(CharacterV2Schema.parse({
      ...character,
      combat,
      inventory,
      spellcasting,
      traits,
      currency,
      revision: character.revision + 1,
      metadata: { ...character.metadata, updatedAt },
    }),command,character),command.kind),command.kind),
    effects,
  };
}
