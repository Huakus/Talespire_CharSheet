import type { EquipmentDefinitionDraft } from "../domain/equipment/equipment-definition";
import type { InventoryViewItem } from "./inventory-view";
type Block = EquipmentDefinitionDraft["description"][number];

const summaryIds = new Set(["official-base-table", "official-table", "official-table-row", "reviewed-equipment-table", "game-row", "ammunition-row"]);
const coveredColumns = new Set(["Objeto", "Objeto base", "Precio", "Precio base", "Precio del objeto mundano", "Coste", "Peso", "Daño base", "Bonificación mágica", "Bonificación mágica al ataque", "Propiedades", "Daño versátil", "Alcance normal/largo (pies)", "CA base", "Destreza", "Fuerza mínima", "Sigilo"]);

/** Only known, single-item summaries whose fields have a live representation. Rule tables stay. */
export function inventorySummaryTable(block: Block, item: InventoryViewItem): boolean {
  if (block.type !== "table" || !summaryIds.has(block.id) || block.rows.length !== 1 || !block.columns.length || block.rows[0]?.length !== block.columns.length || !block.columns.every(c => coveredColumns.has(c))) return false;
  if (block.columns.some(c => /Daño|Bonificación mágica al ataque|Alcance/.test(c)) && !item.weapon) return false;
  if (block.columns.some(c => ["CA base", "Destreza", "Fuerza mínima", "Sigilo"].includes(c)) && !item.armor) return false;
  return true;
}

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
const currency: Record<string,string> = {cp:"pc",sp:"pp",ep:"pe",gp:"po",pp:"ppt"};

/** Read the current copy, never the price/damage/armor values embedded in prose. */
export function renderInventorySummary(item: InventoryViewItem): string {
  const facts: Array<[string,string]> = [
    ["Valor registrado", `${item.cost.quantity} ${currency[item.cost.unit] ?? item.cost.unit}`],
    ["Peso por unidad", `${item.unitWeight} lb`],
  ];
  if (item.weapon) {
    const w = item.weapon;
    if (w.damageExpression) facts.push(["Daño base", `${w.damageExpression}${w.damageBonus ? ` ${signed(w.damageBonus)}` : ""} ${w.damageType}`.trim()]);
    if (w.versatileDamageExpression) facts.push(["A dos manos", `${w.versatileDamageExpression}${w.damageBonus ? ` ${signed(w.damageBonus)}` : ""}`]);
    if (w.attackBonus) facts.push(["Bono de ataque del objeto", signed(w.attackBonus)]);
    if (w.normalRange !== null) facts.push(["Alcance", `${w.normalRange}${w.longRange === null ? "" : `/${w.longRange}`} pies`]);
  }
  if (item.armor) {
    const a = item.armor;
    facts.push([a.armorCategory === "shield" ? "Bono del escudo" : "CA base", `${a.armorCategory === "shield" ? "+" : ""}${a.base}${a.dexterityBonus ? ` + DES${a.maximumDexterityBonus === null ? "" : ` (máx. ${signed(a.maximumDexterityBonus)})`}` : ""}`]);
    const bonus = item.bonuses.filter(b => b.category === "combatStats" && b.key === "AC" && b.valueSource === null).reduce((sum,b) => sum+b.value,0);
    if (bonus) facts.push(["Bono de CA del objeto", signed(bonus)]);
    if (a.strengthRequirement) facts.push(["Fuerza mínima", String(a.strengthRequirement)]);
    if (a.stealthDisadvantage) facts.push(["Sigilo", "Desventaja"]);
  }
  return `<div class="action-readouts inventory-current-facts">${facts.map(([label,value])=>`<span>${escape(label)} <strong>${escape(value)}</strong></span>`).join("")}</div>`;
}
