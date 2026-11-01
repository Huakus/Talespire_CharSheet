import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";

const StableIdSchema = z.string().regex(STABLE_ID_PATTERN);

export const GmNoteSchema = z.object({
  id: StableIdSchema,
  title: z.string().min(1),
  content: z.string(),
});

export const GmNoteGroupSchema = z.object({
  id: StableIdSchema,
  title: z.string().min(1),
  notes: z.array(GmNoteSchema),
});

export const GmRandomTableSchema = z.object({
  id: StableIdSchema,
  name: z.string().min(1),
  entries: z.array(z.string().min(1)),
});

export const GmCharacterGroupSchema = z.object({
  id: StableIdSchema,
  name: z.string().trim().min(1).max(100),
  revision: z.number().int().nonnegative().default(0),
  characterIds: z.array(StableIdSchema).refine(ids => new Set(ids).size === ids.length, "Una hoja no puede repetirse en el grupo."),
});
export type GmCharacterGroup = z.infer<typeof GmCharacterGroupSchema>;

export const MiniatureAssociationSchema = z.object({
  combatantName: z.string().min(1).nullable().default(null),
  displayName: z.string().default(""),
  boardAssetId: z.string().default(""),
  monster: z.object({
    definitionId: z.string().min(1),
    name: z.string().min(1),
    armorClass: z.number().int().nonnegative(),
    hitPoints: z.number().int().nonnegative(),
  }).nullable().default(null),
  characterId: StableIdSchema.nullable().default(null),
  updatedAt: z.string().datetime({ offset: true }),
});

const GmWorkspaceFieldsSchema = z.object({
  noteGroups: z.array(GmNoteGroupSchema).default([]),
  randomTables: z.array(GmRandomTableSchema).default([]),
  googleDocsUrl: z.string().default(""),
  miniatureAssociations: z.record(z.string().min(1), MiniatureAssociationSchema).default({}),
  characterGroups: z.array(GmCharacterGroupSchema).superRefine((groups, context) => {
    const ids = new Set<string>(), members = new Set<string>();
    groups.forEach((group, index) => {
      if (ids.has(group.id)) context.addIssue({ code: "custom", message: "El grupo está repetido.", path: [index, "id"] });
      ids.add(group.id);
      for (const character of group.characterIds) {
        if (members.has(character)) context.addIssue({ code: "custom", message: "Una hoja sólo puede pertenecer a un grupo.", path: [index, "characterIds"] });
        members.add(character);
      }
    });
  }).optional(),
});

type WorkspaceFields = z.infer<typeof GmWorkspaceFieldsSchema>;
type WorkspaceWithOptionalGroups = Omit<WorkspaceFields, "characterGroups"> & { characterGroups?: GmCharacterGroup[] };
export const GmWorkspaceSchema = GmWorkspaceFieldsSchema.transform((value): WorkspaceWithOptionalGroups => {
  const { characterGroups, ...rest } = value;
  return characterGroups === undefined ? rest : { ...rest, characterGroups };
});

type ParsedGmWorkspace = z.infer<typeof GmWorkspaceSchema>;
export type GmWorkspace = Omit<ParsedGmWorkspace, "miniatureAssociations"> & {
  miniatureAssociations?: ParsedGmWorkspace["miniatureAssociations"];
};
export type GmNoteGroup = z.infer<typeof GmNoteGroupSchema>;
export type GmRandomTable = z.infer<typeof GmRandomTableSchema>;
export type MiniatureAssociation = z.infer<typeof MiniatureAssociationSchema>;

export function removeGmNoteGroup(workspace: GmWorkspace, groupId: string): GmWorkspace {
  return GmWorkspaceSchema.parse({
    ...workspace,
    noteGroups: workspace.noteGroups.filter((group) => group.id !== groupId),
  });
}
