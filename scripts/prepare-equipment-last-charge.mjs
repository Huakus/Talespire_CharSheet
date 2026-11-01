import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';import{createServer}from'vite';
const root='docs/v2/equipment-last-charge-2026-11-01/',rows=[0,1].flatMap(i=>JSON.parse(readFileSync(root+'before-'+i+'.json','utf8'))),server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');const changes=[];
 for(const row of rows){const d=EquipmentDefinitionDraftSchema.parse(row.definition);assert.ok(row.charges&&row.charges.maximum>0);assert.ok(!d.capabilities.some(c=>c.id==='last-charge-check'));
  const blocks=d.description.filter(b=>b.type==='paragraph'&&/(última|ultima).?carga/i.test(b.text));assert.ok(blocks.length,row.name);
  d.capabilities.push({id:'last-charge-check',name:'Última carga',activation:'trigger',trigger:'Al gastar la última carga del objeto.',requirements:structuredClone(d.requirements),target:'El objeto',range:'',duration:'Instantánea',concentration:false,costs:[],consumeQuantity:0,effects:[{id:'destroy-on-one',kind:'last-charge-destruction',condition:'Después de gastar la última carga.',sides:20,destroyAtOrBelow:1}],execution:{mode:'automatic',handler:'equipment-last-charge',explanation:'Registra la comprobación pendiente y retira únicamente el ejemplar destruido al resolver el d20. La recarga queda bloqueada hasta resolverla.',pendingAutomation:[]},textBlockIds:blocks.map(b=>b.id)});
  EquipmentDefinitionDraftSchema.parse(d);changes.push({...row,definition:d});
 }
 writeFileSync(root+'reviews.json',JSON.stringify({baselineRevision:1744,changes}));console.log(JSON.stringify({definitions:changes.length,ece:changes.filter(r=>r.scope==='ece').length,shared:changes.filter(r=>r.scope==='shared').length}));
}finally{await server.close();}
