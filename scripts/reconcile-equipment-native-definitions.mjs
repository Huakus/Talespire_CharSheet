import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';import{createServer}from'vite';
const root='docs/v2/equipment-native-reconciliation-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8')),rows=Array.from({length:9},(_,i)=>read('before-'+String(i).padStart(2,'0')+'.json')).flat(),review=read('reviewed-keys.json');
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts'),{inventoryToolIdentity}=await server.ssrLoadModule('/src/domain/equipment/equipment-tool-checks.ts'),{equipmentPlainDescription}=await server.ssrLoadModule('/src/domain/equipment/equipment-live.ts');
 const changes=[];let counters={tools:0,narrative:0,stats:0,weapons:0,books:0,storage:0};
 const automatic=(cap,handler,explanation)=>{cap.execution={mode:'automatic',handler,explanation,pendingAutomation:[]};};
 for(const r of rows){
  const d=EquipmentDefinitionDraftSchema.parse(r.definition),features=structuredClone(r.features),before=JSON.stringify(d),beforeFeatures=JSON.stringify(features);let charges=r.charges;
  const tool=inventoryToolIdentity({category:d.category,name:d.name,rules:{definition:d}});
  if(d.category==='tool'&&tool){
   for(const cap of d.capabilities)if(['mundane-use','mundane-rule','mundane-assisted-use'].includes(cap.id)&&cap.effects.every(e=>e.kind==='unmodeled')){
    cap.effects=[{id:'tool-check',kind:'tool-check',toolKey:tool.key,condition:''}];
    automatic(cap,'equipment-tool-check','Prueba de herramienta con característica elegida, competencia, pericia y Talento Seguro cuando corresponden.');counters.tools++;
   }
  }
  if(review.narrative.includes(r.key)){
   for(const cap of d.capabilities){assert.equal(cap.costs.length,0);assert.equal(cap.consumeQuantity,0);assert.ok(cap.effects.every(e=>['unmodeled','narrative'].includes(e.kind)),r.name);
    cap.effects=[{id:'table-use',kind:'narrative',condition:'',instructions:equipmentPlainDescription(d)}];cap.execution={mode:'narrative',handler:null,explanation:'Uso físico o narrativo según las reglas del objeto.',pendingAutomation:[]};counters.narrative++;
   }
  }
  if(review.verified.includes(r.key))for(const cap of d.capabilities){
   if(cap.effects.every(e=>e.kind==='bonus')){automatic(cap,'equipment-passive-bonus','Proyección de la bonificación mientras se cumplen los requisitos del objeto.');counters.stats++;}
   else if(cap.effects.every(e=>e.kind==='spell-slot-capacity')){automatic(cap,'equipment-spell-slot-capacity','Capacidad adicional, gasto y recuperación según la reserva del portador.');counters.stats++;}
  }
  for(const cap of d.capabilities){
   if(['vicious-natural-20','flaming-hit','phase-blade'].includes(cap.id)){automatic(cap,'equipment-weapon-hit','Daño del arma según el resultado del impacto; los bonos fijos no se duplican en los críticos.');counters.weapons++;if(cap.id==='phase-blade')for(const e of cap.effects)e.condition='Solo con un 20 natural en un ataque de Stix. Los dados adicionales del ataque siguen la regla de críticos de 2014.';}
   if(cap.id==='flaming-toggle'){automatic(cap,'equipment-flame-toggle','Activar o apagar las llamas como acción adicional. Se apagan al quitar el arma.');for(const f of features)if(f.id===cap.id){f.toggleable=true;f.showInActions=true;f.kind='bonus-action';}}
  }
  if(review.books[r.key]){
   assert.equal(d.capabilities.length,1);const cap=d.capabilities[0],resource=d.resources[0];
   cap.name='Estudio del libro';cap.activation='other';cap.duration='48 horas de estudio dentro de seis días';cap.costs=[];cap.consumeQuantity=0;cap.concentration=false;cap.requirements.presence='possessed';
   cap.effects=[{id:'study-'+review.books[r.key],kind:'study',condition:'Completar el estudio; la magia del libro debe estar disponible.',ability:review.books[r.key],hours:48,days:6,increase:2,maximumIncrease:2}];
   automatic(cap,'equipment-study','Sesiones de estudio, aumento permanente del atributo y su máximo, consumo de la magia del libro.');
   d.resources=[{id:resource?.id??'book-magic',name:'Magia del libro',kind:'uses',maximum:1,unit:'lecturas',recovery:{kind:'event',event:'other',explanation:'Recupera su magia cuando pasa un siglo.',amount:{kind:'full'}},exhaustion:'El libro ha perdido su magia hasta que transcurra un siglo.'}];
   if(!charges)charges={current:1,maximum:1,reset:'other'};
   for(const f of features)if(f.id===cap.id){f.name=cap.name;f.kind='other';f.toggleable=false;f.showInActions=false;f.active=false;}
   counters.books++;
  }
  if(r.key==='official:equipment:es:ef95f23bd99224f3cdf64a7d')for(const cap of d.capabilities)if(cap.effects.every(e=>e.kind==='storage')){automatic(cap,'equipment-spell-storage','Almacenar y lanzar conjuros con sus estadísticas originales y su capacidad por niveles.');counters.storage++;}
  EquipmentDefinitionDraftSchema.parse(d);
  if(JSON.stringify(d)!==before||JSON.stringify(features)!==beforeFeatures||JSON.stringify(charges)!==JSON.stringify(r.charges))changes.push({...r,definition:d,features,charges});
 }
 writeFileSync(root+'reviews.json',JSON.stringify({counters,changes}));console.log(JSON.stringify({reviewed:rows.length,changed:changes.length,byScope:Object.fromEntries(['ece','shared'].map(s=>[s,changes.filter(c=>c.scope===s).length])),counters}));
}finally{await server.close();}
