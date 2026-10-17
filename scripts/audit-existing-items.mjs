/** Read-only/offline exploratory audit. Reads exported snapshots; writes reports only. */
import { createServer } from "vite";
import { readFileSync,writeFileSync,mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const raw = "tmp/item-audit",out = "docs/v2/item-audit-2026-10-16";
mkdirSync(out,{ recursive: true });
const read = (p) => JSON.parse(readFileSync(p,"utf8"));
const catalog = [0,500,1000,1500].flatMap((n) => read(`${raw}/catalog-${n}.json`));
const context = read(`${raw}/context.json`)[0].data,rows = read(`${raw}/owned.json`),other = read(`${raw}/other_campaigns.json`);
const owners = new Map(rows.filter((r) => r.fragment_kind === "character-core").map((r) => [r.entity_id,r.payload.name]));
const normalize = (v) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const hash = (v) => createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("hex");
const count = (xs,fn) => Object.fromEntries([...xs.reduce((m,x) => m.set(fn(x),(m.get(fn(x)) ?? 0)+1),new Map())].sort((a,b) => b[1]-a[1]));
const group = (xs,fn) => [...xs.reduce((m,x) => { const key = fn(x);m.set(key,[...(m.get(key) ?? []),x]);return m; },new Map())].filter(([key,g]) => key && g.length>1);
const csv = (name,rs) => {
  const keys = [...new Set(rs.flatMap(Object.keys))],cell = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  writeFileSync(`${out}/${name}`,"\ufeff"+keys.map(cell).join(",")+"\n"+rs.map((r) => keys.map((k) => cell(Array.isArray(r[k]) ? r[k].join(" | ") : r[k])).join(",")).join("\n"));
};
const server = await createServer({ configFile: false,root: process.cwd(),server: { middlewareMode: true },appType: "custom" });
try {
  const { normalizeEquipmentDefinition,EQUIPMENT_CATEGORIES } = await server.ssrLoadModule("/src/domain/equipment/equipment-catalog.ts");
  const { parseCampaignContentPayload } = await server.ssrLoadModule("/src/domain/content/content-payload.ts");
  const { CharacterInventoryItemV2Schema } = await server.ssrLoadModule("/src/domain/character/character-inventory-model.ts");
  const { isSpanishCampaignContent } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { PHB_EQUIPMENT } = await server.ssrLoadModule("/src/domain/character/fighter-builder-catalog.ts");
  const inspect = (p,native = false) => {
    let value,error = "";
    try { value = native ? CharacterInventoryItemV2Schema.parse(p) : normalizeEquipmentDefinition(parseCampaignContentPayload("equipment",p)); } catch(e) { error = String(e.message).slice(0,300); }
    if (!value) return { value: null,error,flags: ["no_carga"] };
    const text = value.description, flags = [];
    if (!text.trim()) flags.push("sin_descripcion");
    if (/<\/?(?:br|p|div|span|table|tr|td|th|b|i|ul|li|strong|em|a|h[1-6])\b/i.test(text)) flags.push("html_literal");
    if (/&(?:nbsp|amp|lt|gt|quot|#\d+);/i.test(text)) flags.push("entidades_html");
    if (/\[object Object\]|undefined|\[\[|\{\s*"/.test(text)) flags.push("serializacion_visible");
    if (/Ã[\x80-\xBF\u00A0-\u00BF]|Â[\x80-\xBF\u00A0-\u00BF]|�|â€/.test(text)) flags.push("codificacion_sospechosa");
    if (/\\[nrt]|\\u[0-9a-f]{4}/i.test(text)) flags.push("escapes_literales");
    if (/\|[^\n|]+\|[^\n|]+\||\n\s*[-:]+\s*\|/.test(text)) flags.push("tabla_sin_estructura");
    if (text && text.length<30) flags.push("descripcion_muy_breve");
    if (p.description !== undefined && p.desc !== undefined && JSON.stringify(p.description)!==JSON.stringify(p.desc)) flags.push("dos_descripciones_distintas");
    if (!EQUIPMENT_CATEGORIES.includes(value.category)) flags.push("categoria_no_canonica");
    if (value.weapon && /\/|\bor\b|\bo\b|,/.test(value.weapon.damageExpression)) flags.push("dano_no_formula_unica");
    if (value.charges && !["short-rest","long-rest"].includes(value.charges.reset)) flags.push("recarga_sin_automatizacion_de_descanso");
    const featureText = [text,...value.features.map((f) => f.description)].join("\n");
    const clues = [];
    for (const [label,pattern] of Object.entries({ conjuros: /\bspell|conjur|hechiz|lanzar\b/i,cargas: /\bcharges?\b|\bcargas?\b/i,curacion: /heal|curaci|restaur.*puntos|recuper.*puntos/i,resistencia: /resistan|resisten|inmun|immun/i,movimiento: /flying|fly speed|velocidad|volar|teleport|teletransport|swimming|escalar/i,atributo_fijo: /score is|puntuaci[oó]n.*(?:19|21|23|25|27|29)|(?:fuerza|inteligencia|constituci[oó]n).*\b(?:19|21|23|25|27|29)\b/i,condicion: /poisoned|paraly[sz]|frighten|charmed|envenenad|paralizad|asustad|hechizad/i,espacio_extradimensional: /extradimension|bag of holding|bolsa de contenci|portable hole|agujero port[aá]til/i })) if (pattern.test(featureText)) clues.push(label);
    const structured = { weapon: !!value.weapon,armor: !!value.armor,bonuses: value.bonuses.length,features: value.features.length,featureBonuses: value.features.reduce((n,f) => n+f.bonuses.length,0),charges: !!value.charges,rolls: value.features.reduce((n,f) => n+f.rolls.length,0),uses: value.features.filter((f) => f.uses).length };
    if (clues.includes("cargas") && !value.charges) flags.push("texto_cargas_sin_recurso");
    if (clues.includes("conjuros") && !value.features.length) flags.push("texto_conjuros_sin_capacidad");
    return { value,error,flags,clues,structured };
  };
  const entries = catalog.map((r) => {
    const a = inspect(r.payload), lang = r.tags.some((s) => ["eng","en"].includes(s)) ? "en" : r.tags.includes("es") || r.payload.language === "es" ? "es" : "sin_marcar";
    const visible = isSpanishCampaignContent({ ...r,contentKey: r.content_key });
    return { ...a,key: r.content_key,name: r.name,origin: r.origin,lang,visible,tags: r.tags,index: r.payload.index ?? "",versioned: r.payload.schemaVersion === 1,raw: r.payload };
  });
  const byKey = new Map(entries.map((e) => [e.key,e])),byName = new Map();
  for (const e of entries) byName.set(normalize(e.name),[...(byName.get(normalize(e.name)) ?? []),e]);
  const inventory = rows.filter((r) => r.fragment_kind === "character-inventory").map((r) => {
    const a = inspect(r.payload,true),key = r.payload.catalog?.contentKey;
    const exact = key ? byKey.get(key) : null,candidates = exact ? [exact] : byName.get(normalize(r.payload.name)) ?? [];
    const spells = rows.filter((s) => s.fragment_kind === "character-spell" && s.parent_id === r.parent_id && s.payload.casting?.source?.startsWith(`inventory:${r.entity_id}:`));
    const actions = rows.filter((s) => s.fragment_kind === "character-action" && s.parent_id === r.parent_id && s.payload.inventoryItemId === r.entity_id);
    const differences = exact?.value && a.value ? ["description","category","properties","weapon","armor","bonuses","features","requiresAttunement"].filter((key) => hash(a.value[key])!==hash(exact.value[key])) : [];
    return { ...a,owner: owners.get(r.parent_id) ?? r.parent_id,ownerId: r.parent_id,id: r.entity_id,name: r.payload.name,key: key ?? "",link: exact ? "referencia_explicita" : candidates.length===1 ? "nombre_unico_sin_referencia" : candidates.length>1 ? "nombre_ambiguo_sin_referencia" : "sin_coincidencia",candidates: candidates.map((e) => e.key),linkedSpells: spells.map((s) => s.payload.name),linkedActions: actions.map((s) => s.payload.name),differences,raw: r.payload };
  });
  for (const e of entries) {
    e.explicitUsers = inventory.filter((i) => i.key === e.key).map((i) => i.owner);
    e.nameUsers = inventory.filter((i) => normalize(i.name)===normalize(e.name)).map((i) => i.owner);
  }
  const duplicateNames = group(entries,(e) => normalize(e.name)).map(([name,es]) => ({ normalized: name,entries: es.map((e) => ({ key: e.key,name: e.name,lang: e.lang,origin: e.origin,descriptionHash: hash(e.value?.description),mechanicsHash: hash(e.value ? { ...e.value,name: "",description: "",catalog: null } : null) })),sameDefinition: new Set(es.map((e) => hash(e.value))).size===1 }));
  const indices = group(entries,(e) => e.index).map(([index,es]) => ({ index,names: es.map((e) => e.name),keys: es.map((e) => e.key),languages: [...new Set(es.map((e) => e.lang))] }));
  const sharedChanges = context.shared.filter((e) => e.payload !== null).map((s) => {
    const e = byKey.get(s.content_key),shared = normalizeEquipmentDefinition(s.payload);
    return { key: s.content_key,sharedName: s.name,eceName: e?.name,changedFields: [...new Set([...Object.keys(shared),...Object.keys(e?.value ?? {})])].filter((k) => hash(shared[k])!==hash(e?.value?.[k])),explicitUsers: e?.explicitUsers,nameUsers: e?.nameUsers };
  });
  const stats = (es) => ({ count: es.length,failed: es.filter((e) => e.error).length,flags: count(es.flatMap((e) => e.flags),(x) => x),categories: count(es,(e) => e.value?.category ?? "error"),rarities: count(es,(e) => e.value?.rarity ?? "inventory_no_rarity"),capabilities: { weapons: es.filter((e) => e.structured?.weapon).length,armor: es.filter((e) => e.structured?.armor).length,bonuses: es.filter((e) => e.structured?.bonuses || e.structured?.featureBonuses).length,features: es.filter((e) => e.structured?.features).length,charges: es.filter((e) => e.structured?.charges).length,rolls: es.filter((e) => e.structured?.rolls).length },textClues: count(es.flatMap((e) => e.clues ?? []),(x) => x) });
  const families = (e) => e.structured?.weapon ? "Armas" : e.structured?.armor ? "Armaduras y escudos" : e.value?.category === "potion" ? "Pociones" : e.value?.category === "wondrous-item" ? "Objetos maravillosos" : /tool/.test(e.value?.category ?? "") ? "Herramientas e instrumentos" : e.value?.category === "mounts-and-vehicles" ? "Monturas y vehículos" : e.value?.category === "adventuring-gear" ? "Equipo de aventura" : "Clasificación pendiente";
  const report = {
    scope: "Exploración de solo lectura del catálogo compartido, ECE, fichas y stock de NPC; otras campañas solo conteos/comparación. Las señales de texto y coincidencias por nombre son candidatos, no reglas ni identidades confirmadas.",
    catalog: { total: entries.length,shared: context.shared.length,campaignOnly: entries.filter((e) => !context.shared.some((s) => s.content_key===e.key)).length,origins: count(entries,(e) => e.origin),languages: count(entries,(e) => e.lang),visible: entries.filter((e) => e.visible).length,versioned: entries.filter((e) => e.versioned).length,...stats(entries) },
    visible: stats(entries.filter((e) => e.visible)),families: count(entries.filter((e) => e.visible),families),
    provenance: { inlineSource: count(entries.filter((e) => e.visible),(e) => e.raw.source ?? "Sin fuente bibliográfica"),sourceMissing: entries.filter((e) => e.visible && !e.raw.source).length,nativeFormat: entries.filter((e) => e.visible && e.versioned).length,legacyFormat: entries.filter((e) => e.visible && !e.versioned).length },
    builder: { baseSrdEntries: read("src/domain/character/phb-srd-equipment.json").length,effectiveDefinitions: Object.keys(PHB_EQUIPMENT).length,explicitCatalogReferences: Object.values(PHB_EQUIPMENT).filter((e) => !!e.catalog).length,englishExampleNames: ["Orb","Spellbook"].filter((name) => Object.values(PHB_EQUIPMENT).some((e) => e.name===name)) },
    resources: { visibleRecharge: count(entries.filter((e) => e.visible && e.value?.charges),(e) => e.value.charges.reset || "Sin regla de recuperación"),ownedZeroMaximum: inventory.filter((i) => i.value?.charges && i.value.charges.maximum===0).map((i) => ({ owner: i.owner,name: i.name })),ownedRecharge: count(inventory.filter((i) => i.value?.charges),(i) => i.value.charges.reset || "Sin regla de recuperación") },
    structuredFeatures: { visibleKinds: count(entries.filter((e) => e.visible).flatMap((e) => e.value?.features ?? []),(f) => f.kind),visibleWithNonPassiveFeature: entries.filter((e) => e.visible && e.value?.features.some((f) => f.kind!=="passive")).length },
    inventory: { ...stats(inventory),owners: owners.size,ownersWithInventory: new Set(inventory.map((i) => i.ownerId)).size,links: count(inventory,(i) => i.link),withFeatures: inventory.filter((e) => e.structured?.features).length,withItemSpells: inventory.filter((i) => i.linkedSpells.length).length,withLinkedActions: inventory.filter((i) => i.linkedActions.length).length,explicitlyLinkedButDifferent: inventory.filter((i) => i.differences.length).map((i) => ({ owner: i.owner,name: i.name,key: i.key,fields: i.differences })) },
    duplicateNames,indices,sharedChanges,customs: entries.filter((e) => e.origin!=="official").map((e) => ({ name: e.name,key: e.key,origin: e.origin,language: e.lang,flags: e.flags,capabilities: e.structured,explicitUsers: e.explicitUsers,nameUsers: e.nameUsers })),
    perOwner: [...owners].map(([id,name]) => ({ name,items: inventory.filter((i) => i.ownerId===id).length,withoutCatalogReference: inventory.filter((i) => i.ownerId===id&&!i.key).length,withFeatures: inventory.filter((i) => i.ownerId===id&&i.structured?.features).length,withSpells: inventory.filter((i) => i.ownerId===id&&i.linkedSpells.length).length })),
    shops: context.shops.map((s) => ({ name: s.name,npc: s.payload.npcId,categories: s.payload.categories })),
    monsterStocks: (context.monster_inventory ?? []).map((m) => ({ name: m.name,origin: m.origin,count: m.inventory.length,names: m.inventory.map((i) => i.name) })),otherCampaigns: other,
    examples: entries.filter((e) => e.lang==="es" && e.flags.some((f) => f!=="sin_descripcion")).slice(0,35).map((e) => ({ name: e.name,key: e.key,flags: e.flags,excerpt: e.value?.description.slice(0,350) })),
  };
  writeFileSync(`${out}/resumen.json`,JSON.stringify(report,null,2));
  csv("catalogo-clasificado.csv",entries.map((e) => ({ nombre: e.name,clave: e.key,origen_de_fila: e.origin,idioma_etiquetado: e.lang,visible: e.visible,familia: families(e),categoria: e.value?.category,rareza: e.value?.rarity,fuente_declarada: e.raw.source ?? "Sin fuente bibliográfica",pagina_declarada: e.raw.page ?? "",indice_heredado: e.index,formato_versionado: e.versioned,problemas_candidatos: e.flags,funciones_mencionadas: e.clues,capacidades_estructuradas: e.structured?.features ?? 0,bonos: e.structured?.bonuses ?? 0,cargas: !!e.value?.charges,recarga: e.value?.charges?.reset ?? "",requiere_sintonizacion: e.value?.requiresAttunement ?? false,usuarios_por_referencia: [...new Set(e.explicitUsers)],usuarios_por_nombre_no_confirmados: [...new Set(e.nameUsers)],error_carga: e.error })));
  csv("inventarios-clasificados.csv",inventory.map((i) => ({ personaje: i.owner,nombre: i.name,id: i.id,clave_catalogo: i.key,vinculo: i.link,candidatos_catalogo: i.candidates,equipado: i.value?.equipped,sintonizado: i.value?.attuned,requiere_sintonizacion: i.value?.requiresAttunement,problemas_candidatos: i.flags,funciones_mencionadas: i.clues,capacidades: i.structured?.features ?? 0,conjuros_vinculados: i.linkedSpells,acciones_vinculadas: i.linkedActions,diferencias_referencia: i.differences })));
  csv("versiones-divergentes.csv",sharedChanges.map((e) => ({ nombre_compartido: e.sharedName,nombre_ece: e.eceName,clave: e.key,campos_distintos: e.changedFields,usuarios_por_referencia: e.explicitUsers,usuarios_por_nombre_no_confirmados: e.nameUsers })));
  csv("duplicados-por-nombre.csv",duplicateNames.map((e) => ({ nombre_comparado: e.normalized,nombres: e.entries.map((r) => r.name),claves: e.entries.map((r) => r.key),origenes: e.entries.map((r) => r.origin),definicion_identica: e.sameDefinition })));
  writeFileSync(`${raw}/normalized.json`,JSON.stringify({ entries,inventory }));
  console.log(JSON.stringify({ catalog: report.catalog,visible: report.visible,families: report.families,inventory: report.inventory,duplicateNameGroups: duplicateNames.length,indexGroups: indices.length,indexBilingualGroups: indices.filter((i) => i.languages.includes("en")&&i.languages.includes("es")).length,sharedChanges: sharedChanges.length,perOwner: report.perOwner,shops: report.shops,monsterStocks: report.monsterStocks },null,2));
} finally { await server.close(); }
