import type { EquipmentDefinitionDraft } from "./equipment-definition";

/** One independent, event-recovered use per capability. Never treat these as a shared pool. */
export function independentEquipmentUses(definition: EquipmentDefinitionDraft | null) {
  const resources=definition?.resources.filter(r=>r.kind!=="spell-storage")??[];
  if(resources.length<2||!resources.every(r=>r.kind==="uses"&&r.maximum===1&&r.recovery.kind==="event"&&r.recovery.amount.kind==="full"))return [];
  const entries=resources.map(resource=>({resource,capability:definition!.capabilities.find(c=>c.costs.length===1&&c.costs[0]!.resourceId===resource.id&&c.costs[0]!.amount===1)}));
  return entries.every(e=>e.capability)&&new Set(entries.map(e=>e.capability!.id)).size===entries.length?entries:[];
}
