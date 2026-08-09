import { z } from "zod";
import { MerchantInteractionSchema, normalizeMerchantInteraction } from "../commerce/merchant-interaction";
import { CharacterInventoryItemV2Schema } from "../character/character-inventory-model";

export const GmShopSchema = z.object({
  name: z.string().min(1),
  npcId: z.string().optional(),
  categories: z.record(z.string(), z.array(z.string().min(1))),
  inventory: z.array(CharacterInventoryItemV2Schema).optional(),
  tags: z.array(z.string().min(1)).optional(),
  interactions: MerchantInteractionSchema.optional(),
});

export const GmChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  checked: z.boolean(),
});

export type GmShop = z.infer<typeof GmShopSchema>;
export type GmChecklistItem = z.infer<typeof GmChecklistItemSchema>;

export function normalizeShop(name: string, input: unknown): GmShop {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const categorySource = source.categories && typeof source.categories === "object" && !Array.isArray(source.categories)
    ? source.categories as Record<string, unknown>
    : source;
  const categories: Record<string, string[]> = {};
  for (const [category, value] of Object.entries(categorySource)) {
    if (category === "tags" || category === "name" || category === "__catalog") continue;
    const entries = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
    categories[category] = entries.map((entry) => String(entry).trim()).filter(Boolean);
  }
  const tags = Array.isArray(source.tags) ? source.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : undefined;
  const npcId = String(source.npcId ?? source.monsterId ?? "").trim();
  return GmShopSchema.parse({
    name,
    ...(npcId ? { npcId } : {}),
    categories,
    ...(Array.isArray(source.inventory) ? { inventory: source.inventory } : {}),
    ...(tags?.length ? { tags } : {}),
    interactions: normalizeMerchantInteraction(source.interactions),
  });
}

export function normalizeChecklistItem(id: string, input: unknown): GmChecklistItem {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  return GmChecklistItemSchema.parse({
    id,
    text: String(source.text ?? source.itemText ?? source.value ?? "").trim(),
    checked: Boolean(source.checked ?? source.completed),
  });
}

export function reconcileShopInventory(categories: Record<string, string[]>, inventory: readonly string[]): Record<string, string[]> {
  const normalized = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
  const remaining = new Map<string, { name: string; quantity: number }>();
  for (const name of inventory) {
    const key = normalized(name);
    const current = remaining.get(key);
    if (current) current.quantity += 1;
    else remaining.set(key, { name, quantity: 1 });
  }
  const reconciled: Record<string, string[]> = {};
  for (const [category, names] of Object.entries(categories)) {
    const kept = names.filter((name) => {
      const entry = remaining.get(normalized(name));
      if (!entry?.quantity) return false;
      entry.quantity -= 1;
      return true;
    });
    if (kept.length) reconciled[category] = kept;
  }
  const ungrouped = [...remaining.values()].flatMap((entry) => Array.from({ length: entry.quantity }, () => entry.name));
  if (ungrouped.length) reconciled.Inventario = [...(reconciled.Inventario ?? []), ...ungrouped];
  return reconciled;
}
