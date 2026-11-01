import type { CharacterV2 } from "../character/character-v2";
import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import type { CharacterActionV2 } from "../character/character-action-model";
import { abilityModifier, preferredWeaponAbility } from "../character/character-projection";
import { inventoryEquipmentDefinition } from "./equipment-live";

const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const families=[
 ['dagger','daggers','daga','dagas'],['shortsword','shortswords','espada corta','espadas cortas'],['longsword','longswords','espada larga','espadas largas'],
 ['rapier','rapiers','estoque','estoques'],['shortbow','shortbows','arco corto','arcos cortos'],['longbow','longbows','arco largo','arcos largos'],
 ['hand crossbow','hand crossbows','ballesta de mano','ballestas de mano'],['light crossbow','light crossbows','ballesta ligera','ballestas ligeras'],
 ['heavy crossbow','heavy crossbows','ballesta pesada','ballestas pesadas'],['quarterstaff','quarterstaffs','baston','bastones'],
 ['battleaxe','battleaxes','hacha de guerra','hachas de guerra'],['handaxe','handaxes','hacha de mano','hachas de mano'],
 ['light hammer','light hammers','martillo ligero','martillos ligeros'],['warhammer','warhammers','martillo de guerra','martillos de guerra'],
 ['dart','darts','dardo','dardos'],['sling','slings','honda','hondas'],['spear','spears','lanza','lanzas'],
 ['mace','maces','maza','mazas'],['scimitar','scimitars','cimitarra','cimitarras'],['greatsword','greatswords','espadon','espadones'],
 ['club','clubs','garrote','garrotes'],['greatclub','greatclubs','garrote grande','garrotes grandes'],['javelin','javelins','jabalina','jabalinas'],
 ['sickle','sickles','hoz','hoces'],['flail','flails','mangual','manguales'],['glaive','glaives','guja','gujas'],
 ['greataxe','greataxes','hacha a dos manos','hachas a dos manos'],['halberd','halberds','alabarda','alabardas'],
 ['lance','lances','lanza de caballeria','lanzas de caballeria'],['maul','mauls','maza a dos manos','mazas a dos manos'],
 ['morningstar','morningstars','lucero del alba','luceros del alba'],['pike','pikes','pica','picas'],['trident','tridents','tridente','tridentes'],
 ['war pick','war picks','pico de guerra','picos de guerra'],['whip','whips','latigo','latigos'],['blowgun','blowguns','cerbatana','cerbatanas'],['net','nets','red','redes'],
];
export function inventoryWeaponProficient(c:CharacterV2,item:CharacterInventoryItemV2):boolean{
  if(!item.weapon)return false;
  const proficiencies=new Set(c.proficiencies.weapons.flatMap(p=>[p,...p.split(/[,;]+/)]).map(normalize)),category=normalize(item.weapon.category);
  const generic=category.startsWith('simple')||category==='sencilla'?['simple','simpleweapon','simpleweapons','armasimple','armassimples','armasencilla','armassencillas']
    :category.startsWith('martial')||category.startsWith('marcial')?['martial','martialweapon','martialweapons','armamarcial','armasmarciales']:[];
  if(generic.some(p=>proficiencies.has(p)))return true;
  const definition=inventoryEquipmentDefinition(item),names=[item.name,definition?.name??'',...(definition?.aliases??[])];
  if(names.some(n=>proficiencies.has(normalize(n))))return true;
  const word=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const canonical=definition?[definition.name,...definition.aliases]:[item.name];
  const matches=families.flatMap(family=>family.filter(base=>canonical.some(name=>word(name)===word(base)||word(name).startsWith(word(base)+' ')||word(name).startsWith(word(base)+'+'))).map(base=>({family,length:word(base).length})));
  const longest=Math.max(0,...matches.map(m=>m.length));
  return matches.some(m=>m.length===longest&&m.family.some(p=>proficiencies.has(normalize(p))));
}

export function inventoryWeaponAction(c:CharacterV2,item:CharacterInventoryItemV2,id:string):CharacterActionV2{
  const w=item.weapon;if(!w)throw new Error('El objeto no tiene un perfil de arma.');
  const ability=preferredWeaponAbility(c.abilities,item);
  const reach=w.range.toLowerCase().includes('ranged')?w.longRange===null?w.normalRange===null?w.range:`${w.normalRange} ft`:`${w.normalRange??0}/${w.longRange} ft`:item.properties.includes('reach')?'10 ft':'5 ft';
  return{id,order:Math.max(-1,...c.actions.map(a=>a.order))+1,name:item.name,categories:['attack','action'],activation:'Acción',reach,ability,proficient:inventoryWeaponProficient(c,item),attackBonus:w.attackBonus,damageExpression:w.damageExpression,damageBonus:(w.damageExpression?abilityModifier(c.abilities[ability]):0)+w.damageBonus,damageType:w.damageType,weaponType:w.category,properties:item.properties.join(', '),description:item.description,inventoryItemId:item.id,rollMode:'normal'};
}
