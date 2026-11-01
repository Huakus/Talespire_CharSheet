import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
import { CampaignV2Schema } from "../../domain/character/character-v2";
import type { CampaignRepository, CampaignSnapshot } from "../ports/campaign-repository";
import { CampaignRepositoryConflictError } from "../ports/campaign-repository";

const id = z.string().regex(STABLE_ID_PATTERN);
const name = z.string().trim().min(1, "Ingresá un nombre para el grupo.").max(100);
const revision = z.number().int().nonnegative();
const ActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create-group"), groupId: id, name }),
  z.object({ kind: z.literal("rename-group"), groupId: id, expectedRevision: revision, name }),
  z.object({ kind: z.literal("remove-group"), groupId: id, expectedRevision: revision }),
  z.object({ kind: z.literal("move-character"), characterId: id, groupId: id.nullable(), expectedGroupId: id.nullable() }),
  z.object({ kind: z.literal("set-group-hidden"), groupId: id, expectedRevision: revision, hidden: z.boolean() }),
]);
export type CharacterOrganizationAction = z.infer<typeof ActionSchema>;
export interface CharacterOrganizationCommand { expectedCampaignId: string; action: CharacterOrganizationAction }

/** One save changes the whole group. Retries rebase only these fields, preserving unrelated sheet/combat edits. */
export async function organizeCharacters(repository: CampaignRepository, input: CharacterOrganizationCommand): Promise<CampaignSnapshot> {
  const action = ActionSchema.parse(input.action);
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await repository.load();
    if (!current || current.campaign.id !== input.expectedCampaignId) throw new Error("La campaña cambió.");
    const campaign = structuredClone(current.campaign);
    const groups = campaign.gm.characterGroups ??= [];
    const group = groups.find(g => g.id === ("groupId" in action ? action.groupId : null));
    if (action.kind !== "create-group" && action.kind !== "move-character") {
      if (!group || group.revision !== action.expectedRevision) throw new Error("El grupo cambió. Revisá su composición y volvé a intentarlo.");
    }
    const now = new Date().toISOString();
    if (action.kind === "create-group" || action.kind === "rename-group") {
      if (groups.some(g => g.id !== action.groupId && g.name.localeCompare(action.name, "es", { sensitivity: "base" }) === 0)) throw new Error("Ya existe un grupo con ese nombre.");
      if (action.kind === "create-group") {
        if (group) throw new Error("El grupo ya existe.");
        groups.push({ id: action.groupId, name: action.name, characterIds: [], revision: 0 });
      } else { group!.name = action.name; group!.revision++; }
    } else if (action.kind === "remove-group") {
      campaign.gm.characterGroups = groups.filter(g => g.id !== action.groupId);
    } else if (action.kind === "move-character") {
      if (!campaign.characters[action.characterId]) throw new Error("La hoja ya no existe.");
      const previous = groups.find(g => g.characterIds.includes(action.characterId));
      if ((previous?.id ?? null) !== action.expectedGroupId) throw new Error("La hoja cambió de grupo. Revisá su ubicación actual.");
      if (action.groupId && !group) throw new Error("El grupo de destino ya no existe.");
      if ((previous?.id ?? null) === action.groupId) return current;
      for (const entry of groups) {
        if (!entry.characterIds.includes(action.characterId)) continue;
        entry.characterIds = entry.characterIds.filter(value => value !== action.characterId); entry.revision++;
      }
      if (group) { group.characterIds.push(action.characterId); group.revision++; }
    } else {
      for (const characterId of group!.characterIds) {
        const character = campaign.characters[characterId];
        if (!character || character.archived === action.hidden) continue;
        character.archived = action.hidden; character.revision++; character.metadata.updatedAt = now;
      }
      group!.revision++;
    }
    campaign.revision++; campaign.metadata.updatedAt = now;
    try { return await repository.save(CampaignV2Schema.parse(campaign), { kind: "checksum", checksum: current.checksum }); }
    catch (error) { if (!(error instanceof CampaignRepositoryConflictError) || attempt === 3) throw error; }
  }
  throw new Error("No se pudo actualizar la organización de personajes.");
}
