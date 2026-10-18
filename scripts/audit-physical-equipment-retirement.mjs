/** Prove simple physical profiles against already cotejados 2014 base tables. */
import{readFileSync,writeFileSync,mkdirSync}from"node:fs";
import assert from"node:assert/strict";
import{createServer}from"vite";
const root="tmp/equipment-definitions",read=p=>JSON.parse(readFileSync(p,"utf8"));
const rows=[0,1,2,3].flatMap(n=>read(`${root}/cleanup-live-${n}.json`)),byKey=new Map(rows.map(r=>[r.content_key,r]));
const past=["docs/v2/equipment-retirement-2026-10-18/manifest.json","docs/v2/equipment-retirement-2026-10-18/bilingual/manifest.json"];
const retired=new Set(past.flatMap(p=>read(p).rows.map(r=>r.key)));
const bases=read("src/domain/character/phb-srd-equipment.json"),prose=read("docs/v2/equipment-retirement-2026-10-18/weapon-prose-review.json");
const preparation=read(`${root}/latest-preparation-baseline.json`).records;
const candidates=read(`${root}/cleanup-analysis.json`).filter(r=>!retired.has(r.key));
const norm=s=>String(s??"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases={leather:"leather-armor",padded:"padded-armor",hide:"hide-armor","studded-leather":"studded-leather-armor","half-plate":"half-plate-armor",plate:"plate-armor"};
const arrayText=v=>v==null?"":Array.isArray(v)&&v.every(x=>typeof x==="string")?v.join("\n"):typeof v==="string"?v:null;
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
let unaccounted;
try{({unaccountedLegacyEquipmentPaths:unaccounted}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement-evidence.ts"));}finally{await server.close();}
const findings=[];
for(const c of candidates){
 const source=byKey.get(c.key),p=source.payload,m=String(p.index??"").match(/^(.*?)(?:[-+]([123]))?$/);
 const baseKey=aliases[m[1]]??m[1],base=bases.find(b=>b.index===baseKey&&(b.weapon_category||b.armor_class));
 if(!base)continue;
 const bonus=Number(m[2]??0),issues=[],targetKeys=[],targetIssues=[];
 if(bonus&&Number(source.name.match(/\+([123])$/)?.[1])!==bonus)issues.push("enhancement-name-mismatch");
 if(!bonus&&/[+][123]$/.test(source.name))issues.push("base-name-mismatch");
 if(unaccounted(p).length)issues.push("unaccounted-fields");
 if((p.hasCharges??false)||p.chargesOptions)issues.push("unexpected-resource");
 const enText=arrayText(p.description??p.desc);
 if(enText===null)issues.push("unexpected-text-shape");
 if(p.description!==undefined&&p.desc!==undefined&&arrayText(p.description)!==arrayText(p.desc))issues.push("second-description-review");
 if(p.special&&arrayText(p.special))issues.push("special-rule-review");
 if(base.weapon_category){
  const reviewed=prose.find(r=>r.baseIndex===baseKey);
  if(enText!==""&&enText!==reviewed?.text)issues.push("unreviewed-English-prose");
  if((p.bonus??[]).length)issues.push("unexpected-weapon-bonus");
  if(p.damage&&JSON.stringify([p.damage.damage_dice,p.damage.damage_type?.index])!==JSON.stringify([base.damage?.damage_dice,base.damage?.damage_type.index]))issues.push("extra-or-different-damage");
  if(p.two_handed_damage&&JSON.stringify([p.two_handed_damage.damage_dice,p.two_handed_damage.damage_type?.index])!==JSON.stringify([base.two_handed_damage?.damage_dice,base.two_handed_damage?.damage_type.index]))issues.push("extra-or-different-versatile-damage");
  if(p.toHitBonus!==undefined&&Number(p.toHitBonus)!==bonus)issues.push("attack-bonus-mismatch");
  if(p.damageBonus!==undefined&&Number(p.damageBonus)!==bonus)issues.push("damage-bonus-mismatch");
  const properties=new Set((base.properties??[]).map(x=>x.index));
  if((p.properties??[]).some(x=>!properties.has(x.index)&&!["monk","magic"].includes(x.index)))issues.push("extra-property");
 }else{
  if((p.properties??[]).some(p=>p.index!=="magic"))issues.push("extra-armor-property");
  const armorTexts=[
    `This armor is magically infused, granting a +${bonus} bonus to the wearer’s Armor Class.`,
    `While holding this shield, you have a bonus of +${bonus} AC.`,
    `You have a +${bonus} bonus to AC while wearing this armor.`,
  ];
  if(enText&&!armorTexts.includes(enText))issues.push("unreviewed-English-armor-text");
  if((p.bonus??[]).some(b=>b.key!=="AC"||b.category!=="combatStats"||Number(b.value)!==bonus||![`Grants a +${bonus} bonus to AC.`,""].includes(b.description??"")))issues.push("unexpected-armor-bonus");
 }
 for(const candidate of c.candidates){
  const target=byKey.get(candidate.key),d=target.payload.rules.definition,check=[];
  const original=preparation.find(r=>r.payload.definition.id===d.id)?.payload.originals.find(o=>o.scope==="ECE"&&o.originalKey===d.id.slice(9));
  if(!original||norm(original.raw.payload.index)!==norm(p.index))check.push("identity");
  if(d.origin!=="official"||!d.review.identity||!d.review.editorial||!d.sources.some(s=>s.verified&&s.rulesEdition==="2014"&&["srd","book"].includes(s.kind))||d.description.some(b=>b.provenance==="unreviewed"))check.push("official-review");
  if(d.requirements.attunement!==false||d.resources.length)check.push("extra-requirement-or-resource");
  if(p.cost&&(p.cost.quantity!==target.payload.cost.quantity||p.cost.unit!==target.payload.cost.unit))check.push("price-not-retained");
  // Changes of legacy weight follow the verified physical base table, not guesses.
  if(base.weight!==undefined&&d.weight?.unit==="lb"&&d.weight.value!==base.weight)check.push("weight-not-official-base");
  if(base.weapon_category){
   const w=d.weapon,properties=new Set(d.properties);
   if(!w||w.attackBonus!==bonus||w.damageBonus!==(base.damage?bonus:0)||w.category!==base.weapon_category.toLowerCase())check.push("weapon-profile");
   const expected=[...(base.damage?[[base.damage.damage_dice,base.damage.damage_type.index,"base"]]:[]),...(base.two_handed_damage?[[base.two_handed_damage.damage_dice,base.two_handed_damage.damage_type.index,"versatile"]]:[])];
   if(!w||JSON.stringify(w.baseDamage.map(e=>[e.expression,e.damageType,e.timing]))!==JSON.stringify(expected))check.push("damage-profile");
   if((base.properties??[]).some(p=>p.index!=="monk"&&!properties.has(p.index)))check.push("missing-property");
   const range=base.throw_range??(base.weapon_range==="Ranged"?base.range:null);
   if(range&&(!w?.rangeFeet||w.rangeFeet.normal!==range.normal||w.rangeFeet.long!==(range.long??null)))check.push("range-profile");
  }else{
   const a=d.armor,category=String(base.armor_category).toLowerCase();
   if(!a||a.category!==category||a.baseArmorClass!==base.armor_class.base||a.armorClassBonus!==bonus||
     (a.dexterity!=="none")!==(base.armor_class.dex_bonus??false)||
     (a.dexterity==="capped"?a.dexterityCap:null)!==(base.armor_class.max_bonus??null)||
     (a.strengthMinimum??0)!==(base.str_minimum??0)||a.stealthDisadvantage!==(base.stealth_disadvantage??false))check.push("armor-profile");
  }
  if(!check.length)targetKeys.push(target.content_key);else targetIssues.push({key:target.content_key,issues:check});
 }
 if(!targetKeys.length)issues.push("no-verified-destination");
 findings.push({key:c.key,name:source.name,baseIndex:baseKey,enhancement:bonus,targetKeys,issues,targetIssues,
  decision:"Perfil físico cotejado con la tabla oficial de 2014 y, cuando corresponde, la regla genérica +1/+2/+3. La introducción importada no normativa se sustituye por esas reglas; la rareza, peso o restricciones erróneos se corrigen mediante la fuente oficial. Los precios existentes se conservan."});
}
mkdirSync("docs/v2/equipment-retirement-2026-10-18/physical",{recursive:true});
writeFileSync(`${root}/physical-audit.json`,JSON.stringify(findings,null,2));
const counts={};for(const f of findings)for(const i of f.issues)counts[i]=(counts[i]??0)+1;
console.log(JSON.stringify({examined:findings.length,safe:findings.filter(f=>!f.issues.length).length,counts,blocked:findings.filter(f=>f.issues.length).map(f=>({name:f.name,issues:f.issues,targetIssues:f.targetIssues}))}));
