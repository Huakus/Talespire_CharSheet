import type { SpellDefinition } from "../character/character-spell-model";
import type { EquipmentCatalogDraft } from "../equipment/equipment-catalog";
import type { GmChecklistItem, GmShop } from "../gm/gm-global-content";
import type { MonsterDefinition } from "../monsters/monster-catalog";

export interface CampaignContent {
  spells: SpellDefinition[];
  equipment: EquipmentCatalogDraft[];
  monsters: MonsterDefinition[];
  shops: GmShop[];
  checklist: GmChecklistItem[];
}
