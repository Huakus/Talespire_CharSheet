import type{CharacterV2}from"../character/character-v2";
import type{CharacterInventoryItemV2}from"../character/character-inventory-model";
import{equipmentBearerIssue,inventoryEquipmentDefinition}from"./equipment-live";
export type EquipmentFlightAction={kind:"start";altitudeFeet:number}|{kind:"altitude";altitudeFeet:number}|{kind:"land"}|{kind:"elapsed";seconds:number};
export function equipmentFlightRule(item:Pick<CharacterInventoryItemV2,"rules">){return inventoryEquipmentDefinition(item)?.capabilities.flatMap(c=>c.effects).find(e=>e.kind==="flight-reserve")??null;}
export function equipmentFlightState(item:CharacterInventoryItemV2){return item.rules?.flight??{flying:false,descending:false,prepaidSeconds:0,idleSeconds:0,altitudeFeet:0};}
export function stopEquipmentFlight(item:CharacterInventoryItemV2):void{
 if(item.rules?.flight&&(item.rules.flight.flying||item.rules.flight.descending))item.rules.flight={flying:false,descending:false,prepaidSeconds:0,idleSeconds:0,altitudeFeet:0};
}
export function applyEquipmentFlightAction(c:CharacterV2,item:CharacterInventoryItemV2,action:EquipmentFlightAction):void{
 const rule=equipmentFlightRule(item);if(!rule||rule.kind!=="flight-reserve"||!item.rules||!item.charges||item.quantity!==1||item.charges.maximum!==rule.minutes)throw new Error("El objeto no tiene una reserva individual de vuelo válida.");
 if(!item.equipped||item.requiresAttunement&&!item.attuned)stopEquipmentFlight(item);
 const state={...equipmentFlightState(item)},step=rule.minimumFlightMinutes*60;
 if(action.kind==="start"){
  if(!item.equipped||item.requiresAttunement&&!item.attuned)throw new Error("Equipá y sintonizá el objeto antes de volar.");
  const issue=equipmentBearerIssue(c,item);if(issue)throw new Error(issue);
  if(c.combat.hitPoints.current<=0||c.combat.conditions.some(p=>["dead","unconscious","incapacitated","paralyzed","stunned","petrified"].includes(p.key)))throw new Error("Necesitás poder iniciar el vuelo.");
  if(state.flying)throw new Error("El vuelo ya está activo.");
  if(!Number.isFinite(action.altitudeFeet)||action.altitudeFeet<0||action.altitudeFeet>100000)throw new Error("Indicá una altura válida sobre el suelo.");
  if(item.charges.current<rule.minimumFlightMinutes)throw new Error("No quedan minutos de vuelo suficientes.");
  item.charges.current-=rule.minimumFlightMinutes;
  Object.assign(state,{flying:true,descending:false,prepaidSeconds:step,idleSeconds:0,altitudeFeet:action.altitudeFeet});
 }else if(action.kind==="altitude"){
  if(!state.flying||!item.equipped||item.requiresAttunement&&!item.attuned)throw new Error("No hay un vuelo disponible cuya altura actualizar.");
  if(!Number.isFinite(action.altitudeFeet)||action.altitudeFeet<0||action.altitudeFeet>100000)throw new Error("Indicá una altura válida sobre el suelo.");
  state.altitudeFeet=action.altitudeFeet;
 }else if(action.kind==="land"){
  if(!state.flying&&!state.descending)throw new Error("No hay un vuelo activo que terminar.");
  Object.assign(state,{flying:false,descending:false,prepaidSeconds:0,idleSeconds:0,altitudeFeet:0});
 }else{
  if(!Number.isSafeInteger(action.seconds)||action.seconds<=0||action.seconds>31557600)throw new Error("Ingresá segundos enteros positivos, hasta un año de tiempo de campaña.");
  let seconds=action.seconds;
  if(state.flying){
   state.idleSeconds=0;
   while(seconds>0&&state.flying){
    if(state.prepaidSeconds===0){
     if(item.charges.current<rule.minimumFlightMinutes){state.flying=false;state.descending=state.altitudeFeet>0;break;}
     item.charges.current-=rule.minimumFlightMinutes;state.prepaidSeconds=step;
    }
    const elapsed=Math.min(seconds,state.prepaidSeconds);state.prepaidSeconds-=elapsed;seconds-=elapsed;
    if(state.prepaidSeconds===0&&item.charges.current<rule.minimumFlightMinutes){state.flying=false;state.descending=state.altitudeFeet>0;}
   }
  }
  if(state.descending&&seconds>0){const descentSeconds=Math.min(seconds,state.altitudeFeet/rule.descentFeetPerRound*6);state.altitudeFeet=Math.max(0,state.altitudeFeet-descentSeconds/6*rule.descentFeetPerRound);seconds-=descentSeconds;state.descending=state.altitudeFeet>0;}
  if(!state.flying&&!state.descending&&seconds>0){
   const recovery=rule.recoveryHoursUnused*3600,total=state.idleSeconds+seconds,periods=Math.floor(total/recovery);
   item.charges.current=Math.min(item.charges.maximum,item.charges.current+periods*rule.recoveryMinutes);state.idleSeconds=Math.floor(total%recovery);
  }
 }
 item.rules.flight=state;
}
