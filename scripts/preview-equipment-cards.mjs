import {createServer} from "vite";
import {readFileSync,writeFileSync} from "node:fs";
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true,hmr:false},appType:"custom"});
try {
 const {BrowserApp}=await server.ssrLoadModule("/src/ui/browser-app.ts"),{CampaignApplication}=await server.ssrLoadModule("/src/application/campaign/campaign-application.ts"),{InMemoryCampaignRepository}=await server.ssrLoadModule("/src/infrastructure/persistence/in-memory-campaign-repository.ts"),{createCharacter}=await server.ssrLoadModule("/src/domain/character/create-character.ts"),{bindReviewedEquipment}=await server.ssrLoadModule("/src/domain/equipment/equipment-live.ts"),{normalizeEquipmentDefinition}=await server.ssrLoadModule("/src/domain/equipment/equipment-catalog.ts");
 const read=p=>JSON.parse(readFileSync(p,"utf8"));
 const healing=process.argv.includes('--healing');
 const definitions=healing?[...read('docs/v2/equipment-completion-2026-10-19/healing-execution-definitions.json'),read('docs/v2/equipment-completion-2026-10-19/pearl-slot-recovery-definition.json')]:[read("docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json").find(d=>d.name==="Poción de curación"),read("docs/v2/equipment-retirement-2026-10-18/tools-context-definitions.json").find(d=>d.name==="Herramientas de carpintero")];
 const c=createCharacter("chr_11111111111111111111111111111111","Prueba visual de equipo","2026-10-18T19:00:00.000Z");
 c.inventory=definitions.map((d,i)=>bindReviewedEquipment({...normalizeEquipmentDefinition({name:d.name}),id:"inv_"+String(i+1).repeat(32),order:i,group:"Mochila",quantity:i?1:2,equipped:!!i},d));
 c.identity.className='Mago';c.combat.hitPoints={current:10,maximum:20,temporary:0};c.spellcasting.slots['4']={maximum:2,used:1};
 if(healing){const pearl=c.inventory.find(i=>i.name==='Perla de poder');pearl.equipped=true;pearl.attuned=true;pearl.charges.current=1;}
 const recipient=createCharacter('chr_22222222222222222222222222222222','Aliado herido','2026-10-19T22:00:00.000Z');
 const view=new BrowserApp({},new CampaignApplication(new InMemoryCampaignRepository()),{storageLabel:"preview",diceRoller:{roll:async()=>({kind:"rolled",summary:"preview",totals:[6]})}});view.snapshot={campaign:{characters:{[c.id]:c,...(healing?{[recipient.id]:recipient}:{})}}};view.selectedCharacterId=c.id;
 for(const i of c.inventory)view.expandedInventoryDescriptions.add(i.id);
 const css=readFileSync("dist-v2/v2.html","utf8").match(/href="\.\/([^\"]+\.css)"/)[1];
 const cards=c.inventory.map(i=>view.renderInventoryPlayCard(c,i)).join("").replace(/<details class="inventory-tool-check"/g,'<details open class="inventory-tool-check"');
 writeFileSync(`tmp/equipment-definitions/${healing?'healing-cards-preview':'cards-preview'}.html`,`<!doctype html><html lang="es" data-v2-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../../dist-v2/${css}"><title>Revisión de tarjetas de equipo</title><style>body{height:auto;overflow:auto;padding:12px}main{max-width:540px;margin:auto}.inventory-dense-list{padding:8px}</style><main class="character-sheet-shell"><section class="play-section collection-play"><div class="inventory-dense-list">${cards}</div></section></main></html>`);
 console.log("Prepared native inventory cards, with expanded descriptions.");
} finally {await server.close();}
