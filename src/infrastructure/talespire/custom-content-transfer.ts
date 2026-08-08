import { z } from "zod";
import { normalizeEquipmentDefinition, type EquipmentCatalogDraft } from "../../domain/equipment/equipment-catalog";
import { normalizeMonsterDefinition, type MonsterDefinition } from "../../domain/monsters/monster-catalog";
import type { SpellDefinition } from "../../domain/character/character-spell-model";
import { normalizeSpellDefinition } from "../../domain/spells/spell-catalog";
import { checksumJson } from "../../shared/hash";
import { CHUNK_DATA_CHARACTERS, decodeTransferPayload, encodeTransferPayload, randomTransferId, TALESPIRE_MESSAGE_CHARACTER_LIMIT } from "./encounter-transfer";

export const CUSTOM_CONTENT_TRANSFER_PROTOCOL = "t5e-content-xfer";
export const CUSTOM_CONTENT_TRANSFER_VERSION = 1;
export interface PlayerCustomContent { spells: SpellDefinition[]; equipment: EquipmentCatalogDraft[]; monsters: MonsterDefinition[]; }
const base = { p: z.literal(CUSTOM_CONTENT_TRANSFER_PROTOCOL), v: z.literal(CUSTOM_CONTENT_TRANSFER_VERSION) };
const RequestSchema = z.object({ ...base, t: z.literal("req") });
const StartSchema = z.object({ ...base, t: z.literal("start"), x: z.string().regex(/^x_[a-f0-9]{16}$/), c: z.string().regex(/^[a-f0-9]{64}$/), n: z.number().int().positive(), z: z.enum(["gzip", "raw"]) });
const ChunkSchema = z.object({ ...base, t: z.literal("chunk"), x: z.string().regex(/^x_[a-f0-9]{16}$/), i: z.number().int().nonnegative(), n: z.number().int().positive(), d: z.string() });
const EndSchema = z.object({ ...base, t: z.literal("end"), x: z.string().regex(/^x_[a-f0-9]{16}$/) });
const MessageSchema = z.discriminatedUnion("t", [RequestSchema, StartSchema, ChunkSchema, EndSchema]);
export type CustomContentTransferMessage = z.infer<typeof MessageSchema>;
function serialize(message: CustomContentTransferMessage): string { const value = JSON.stringify(MessageSchema.parse(message)); if (value.length > TALESPIRE_MESSAGE_CHARACTER_LIMIT) throw new Error(`CONTENT_MESSAGE_TOO_LONG:${value.length}`); return value; }
export function customContentTransferRequest(): string { return serialize({ p: CUSTOM_CONTENT_TRANSFER_PROTOCOL, v: CUSTOM_CONTENT_TRANSFER_VERSION, t: "req" }); }
export function parseCustomContentTransferMessage(raw: string): CustomContentTransferMessage | null { try { const parsed = MessageSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : null; } catch { return null; } }
export async function buildCustomContentTransfer(content: PlayerCustomContent): Promise<string[]> {
  const snapshot = { schemaVersion: 1, spells: content.spells, equipment: content.equipment, monsters: content.monsters };
  const checksum = await checksumJson(JSON.parse(JSON.stringify(snapshot))); const encoded = await encodeTransferPayload(JSON.stringify(snapshot)); const transferId = randomTransferId();
  const chunks = Array.from({ length: Math.max(1, Math.ceil(encoded.data.length / CHUNK_DATA_CHARACTERS)) }, (_, index) => encoded.data.slice(index * CHUNK_DATA_CHARACTERS, (index + 1) * CHUNK_DATA_CHARACTERS));
  return [serialize({ p: CUSTOM_CONTENT_TRANSFER_PROTOCOL, v: CUSTOM_CONTENT_TRANSFER_VERSION, t: "start", x: transferId, c: checksum, n: chunks.length, z: encoded.encoding }), ...chunks.map((d, i) => serialize({ p: CUSTOM_CONTENT_TRANSFER_PROTOCOL, v: CUSTOM_CONTENT_TRANSFER_VERSION, t: "chunk", x: transferId, i, n: chunks.length, d })), serialize({ p: CUSTOM_CONTENT_TRANSFER_PROTOCOL, v: CUSTOM_CONTENT_TRANSFER_VERSION, t: "end", x: transferId })];
}
interface Assembly { start: Extract<CustomContentTransferMessage, { t: "start" }>; chunks: Map<number, string>; }
export class CustomContentTransferAssembler {
  private readonly assemblies = new Map<string, Assembly>();
  async accept(message: CustomContentTransferMessage): Promise<PlayerCustomContent | null> {
    if (message.t === "start") { this.assemblies.set(message.x, { start: message, chunks: new Map() }); return null; }
    if (message.t === "chunk") { const assembly = this.assemblies.get(message.x); if (assembly && message.n === assembly.start.n && message.i < message.n) assembly.chunks.set(message.i, message.d); return null; }
    if (message.t !== "end") return null; const assembly = this.assemblies.get(message.x); if (!assembly || assembly.chunks.size !== assembly.start.n) return null; this.assemblies.delete(message.x);
    const encoded = Array.from({ length: assembly.start.n }, (_, index) => assembly.chunks.get(index) ?? "").join(""); const raw = await decodeTransferPayload(encoded, assembly.start.z); const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.schemaVersion !== 1 || !Array.isArray(value.spells) || !Array.isArray(value.equipment) || !Array.isArray(value.monsters)) return null;
    if (await checksumJson(JSON.parse(JSON.stringify(value))) !== assembly.start.c) return null;
    return { spells: value.spells.map(normalizeSpellDefinition), equipment: value.equipment.map(normalizeEquipmentDefinition), monsters: value.monsters.map(normalizeMonsterDefinition).filter((monster) => monster.name) };
  }
}
