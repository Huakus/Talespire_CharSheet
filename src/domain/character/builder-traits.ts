import type { CharacterV2 } from "./character-v2";
import type { CharacterTraitV2 } from "./character-content-model";
import { createDeterministicId } from "../../shared/id";

export interface TraitDefinition { key: string; name: string; description: string; maximum?: number; reset?: "none" | "short-rest" | "long-rest" }
export async function traitGroup(character: CharacterV2, key: string, title: string, definitions: TraitDefinition[], managedKeys: string[] = []): Promise<CharacterV2["traits"][number]> {
  const id = await createDeterministicId("trg", character.id, "builder", key);
  const previous = character.traits.find((group) => group.id === id);
  const managedIds = new Set(await Promise.all(managedKeys.map((entry) => createDeterministicId("trt", character.id, "builder", key, entry))));
  const traits = await Promise.all(definitions.map(async (definition, order): Promise<CharacterTraitV2> => {
    const traitId = await createDeterministicId("trt", character.id, "builder", key, definition.key);
    const old = previous?.traits.find((entry) => entry.id === traitId);
    return { id: traitId, order, name: definition.name, description: definition.description, collapsed: old?.collapsed ?? false, uses: { maximum: definition.maximum ?? 0, used: old?.uses.used ?? 0, reset: definition.reset ?? "none" }, adjustment: old?.adjustment ?? null, effect: old?.effect ?? { description: "", active: false } };
  }));
  return { id, order: previous?.order ?? character.traits.length, title, collapsed: previous?.collapsed ?? false, traits: [...traits, ...(previous?.traits.filter((old) => !managedIds.has(old.id) && !traits.some((entry) => entry.id === old.id)) ?? [])] };
}
