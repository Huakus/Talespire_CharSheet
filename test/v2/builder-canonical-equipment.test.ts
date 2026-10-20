import {describe,expect,it} from "vitest";
import raw from "../../src/domain/character/phb-srd-equipment.json";
import cache from "../../src/domain/equipment/builder-equipment-cache.json";
import {PHB_EQUIPMENT,BUILDER_GEAR} from "../../src/domain/character/fighter-builder-catalog";
import {bindGuidedEquipmentCatalog} from "../../src/domain/equipment/guided-equipment-catalog";
import {inventoryEquipmentDefinition} from "../../src/domain/equipment/equipment-live";
import {EquipmentDefinitionDraftSchema} from "../../src/domain/equipment/equipment-definition";
import {createGuidedWizard} from "../../src/domain/character/wizard-builder";
import {phbWizardCreation} from "../fixtures/phb-wizard-builder";
import {CampaignApplication} from "../../src/application/campaign/campaign-application";
import {InMemoryCampaignRepository} from "../../src/infrastructure/persistence/in-memory-campaign-repository";
const now="2026-10-19T22:00:00.000Z";
describe("new characters receive canonical Spanish equipment",()=>{
 it("covers all 237 purchased SRD templates with explicit Spanish identities and rule snapshots",()=>{
  expect(cache).toHaveLength(raw.length);
  for(const source of raw){const item=PHB_EQUIPMENT[source.index]!,entry=cache.find(e=>e.index===source.index)!;
   expect(item.catalog?.contentKey,source.index).toBe(entry.catalog.contentKey);
   expect(inventoryEquipmentDefinition(item)?.language,source.index).toBe("es");
   expect(item.name,source.index).toBe(entry.definition.name);
   expect(item.description,source.index).not.toMatch(/(?:You can|While wearing|An arcane focus|A component pouch|requires attunement)/);
   EquipmentDefinitionDraftSchema.parse(item.rules!.definition);
  }
  expect(PHB_EQUIPMENT['component-pouch']!.name).toBe('Bolsa de componentes');expect(PHB_EQUIPMENT.orb!.name).toBe('Orbe');
  expect(BUILDER_GEAR.pouch!.catalog?.contentKey).toBe(PHB_EQUIPMENT.pouch!.catalog?.contentKey);
 });
 it("uses a current campaign revision on creation while retaining quantities, prices and personal names",async()=>{
  const creation=phbWizardCreation('human','hermit');creation.wizardFocus='orb';
  const c=await createGuidedWizard('chr_11111111111111111111111111111111','build_11111111111111111111111111111111',creation,now);
  const orb=c.inventory.find(i=>i.name==='Orbe')!,current=structuredClone(PHB_EQUIPMENT.orb!);
  current.catalog!.revision+=10;current.rules!.definition.revision=99;
  current.rules!.definition.description=[{id:'updated-rule',type:'paragraph',section:'rules',provenance:'official-spanish',sourceIds:['srd-5.1-es-equipment'],text:'Descripción española actualizada del foco arcano.'}];
  const linked=bindGuidedEquipmentCatalog(c,[current]);
  expect(linked.inventory.find(i=>i.id===orb.id)!.catalog!.revision).toBe(current.catalog!.revision);
  expect(linked.inventory.find(i=>i.id===orb.id)!.description).toContain('Descripción española actualizada');
  expect(linked.inventory.find(i=>i.id===orb.id)!.cost).toEqual(orb.cost);expect(linked.inventory.find(i=>i.id===orb.id)!.quantity).toBe(orb.quantity);
  orb.name='El orbe de mi maestro';expect(bindGuidedEquipmentCatalog(c,[current]).inventory.find(i=>i.id===orb.id)!.name).toBe(orb.name);
  const repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),before=await app.createCampaign(now);
  const after=await app.createGuidedCharacter({operationId:'build_22222222222222222222222222222222',creation,equipmentCatalog:[current],expectedCampaignChecksum:before.checksum,createdAt:now});
  const saved=Object.values(after.campaign.characters)[0]!;
  expect(saved.inventory.find(i=>i.name==='Orbe')!.catalog!.revision).toBe(current.catalog!.revision);
  expect(saved.inventory.some(i=>i.name==='Libro de conjuros')).toBe(true);
  expect(saved.inventory.some(i=>i.name==='Útiles de herborista'&&i.rules)).toBe(true);
 });
});
