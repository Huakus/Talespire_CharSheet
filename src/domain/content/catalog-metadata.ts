import { z } from "zod";

export const CatalogMetadataSchema = z.object({
  contentKey: z.string(),
  origin: z.enum(["official", "gm", "imported"]),
  tags: z.array(z.string()),
  revision: z.number().int().nonnegative(),
});

export type CatalogMetadata = z.infer<typeof CatalogMetadataSchema>;
