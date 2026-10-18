/** Read-only analysis of verified catalog exports and a fresh ECE inventory SELECT. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/item-tags", out = "docs/v2/item-triage-2026-10-17";
const read = (name) => JSON.parse(readFileSync(name, "utf8"));
const all = [0, 500, 1000, 1500].flatMap((n) => read(`${root}/ece-after-${n}.json`));
const live = read(`${root}/triage-live-context.json`), guard = read(`${root}/guards-after.json`);
assert.equal(live.catalog_hash, guard.ece_equipment_hash, "Refresh catalog exports before analyzing a changed catalog");
assert.equal(live.shared_hash, guard.shared_equipment_hash);
const token = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const count = (xs, f) => Object.fromEntries([...xs.reduce((map, row) => map.set(f(row), (map.get(f(row)) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
const owners = new Map(live.rows.filter((r) => r.fragment_kind === "character-core").map((r) => [r.entity_id, r.payload.name]));
const inventory = live.rows.filter((r) => r.fragment_kind === "character-inventory");
const localSrd = read("src/domain/character/phb-srd-equipment.json");
const recommendations = {
  dagadelumbral: "Conservar ambas hasta que el GM determine si Hoja Fásica pertenece a la daga o solo a Stix; no propagar ni gastar cargas por deducción.",
  anillodesalto: "Candidato a unificar: reglas y descripción normalizadas iguales; solo cambia capitalización. Verificar requisitos y referencias antes de retirar la copia.",
  camisotedemallas2: "Conservar dos objetos: los índices y las estadísticas corresponden a Chain Shirt +2 y Chain Mail +2. Corregir el nombre que los confunde y revisar rareza/bono efectivo.",
  granhacha1: "Candidato a unificar tras corregir índice y rareza: una versión +1 usa el índice del arma básica. Mantener separado el Greataxe inglés básico hasta recuperar su equivalente real.",
  arcolargo: "Conservar dos objetos: longbow y vicious-longbow; dar al segundo un nombre que exprese la variante mágica. Resolver qué versión posee Arturo antes de vincular su copia.",
  malladeadamantina: "Candidato a unificar después de cotejar requisitos de Fuerza y desventaja de Sigilo de la armadura base; no conservar por defecto la versión menos restrictiva.",
  espadalarga1: "Candidato a unificar tras cotejar peso, precio y rareza. Garrick tiene referencia explícita; la coincidencia por nombre de Borgar aún necesita resolver identidad. Separar precio de campaña si fue intencional.",
  carro: "Conservar dos objetos: cart y carriage, con costes y pesos distintos. Corregir nombres españoles antes de cualquier fusión.",
  cotademallas3: "Conservar dos objetos: chain-mail-3 y splint-armor-3. Corregir el nombre de la segunda y revisar rareza/bono efectivo.",
  alabarda3: "Candidato a unificar después de cotejar alcance, precio y rareza. No convertir el precio base en precio mágico por deducción.",
  anillodeproteccion: "Candidato a unificar conservando el texto que expresa el bono; cotejar rareza, sintonización y bonos estructurados. La descripción genérica no conserva por sí sola las reglas.",
};
mkdirSync(out, { recursive: true });
const csv = (name, rows) => {
  const keys = [...new Set(rows.flatMap(Object.keys))], cell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  writeFileSync(`${out}/${name}`, "\ufeff" + keys.map(cell).join(",") + "\n" + rows.map((row) => keys.map((key) => cell(row[key])).join(",")).join("\n") + "\n");
};
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { normalizeEquipmentDefinition, EQUIPMENT_CATEGORIES } = await server.ssrLoadModule("/src/domain/equipment/equipment-catalog.ts");
  const { equipmentRowLanguage, stableEquipmentJson } = await server.ssrLoadModule("/src/domain/equipment/classify-equipment.ts");
  const rows = all.filter((r) => equipmentRowLanguage(r) === "es").map((r) => ({ ...r, value: normalizeEquipmentDefinition(r.payload) }));
  const byKey = new Map(rows.map((r) => [r.content_key, r]));
  const byName = new Map(); for (const row of rows) byName.set(token(row.name), [...(byName.get(token(row.name)) ?? []), row]);
  const usage = (row) => inventory.filter((r) => r.payload.catalog?.contentKey === row.content_key || (!r.payload.catalog?.contentKey && token(r.payload.name) === token(row.name)));
  const jsonText = (r) => /\{\s*"/.test(r.value.description);
  const dataChecks = (r) => ({ category: !EQUIPMENT_CATEGORIES.includes(r.value.category), damage: !!r.value.weapon && /\/|\bor\b|\bo\b|,/.test(r.value.weapon.damageExpression), recharge: !!r.value.charges && !r.value.charges.reset });
  const duplicates = [...byName.values()].filter((group) => group.length > 1).map((group) => {
    const fields = [...new Set(group.flatMap((r) => Object.keys(r.value)))].filter((field) => new Set(group.map((r) => stableEquipmentJson(r.value[field]))).size > 1);
    return { nombre: group.map((r) => r.name).join(" / "), claves: group.map((r) => r.content_key).join(" | "), indices: group.map((r) => r.payload.index ?? "sin índice").join(" | "), ingles: group.map((r) => all.filter((en) => equipmentRowLanguage(en) === "en" && en.payload.index && en.payload.index === r.payload.index).map((en) => en.name).join(", ")).join(" | "), campos_distintos: fields.join(" | "), propuesta: recommendations[token(group[0].name)] ?? "Cotejar las versiones antes de resolver.", usuarios_referencia: [...new Set(group.flatMap((r) => usage(r).filter((i) => i.payload.catalog?.contentKey).map((i) => owners.get(i.parent_id))))].join(" | "), usuarios_por_nombre_no_confirmados: [...new Set(group.flatMap((r) => usage(r).filter((i) => !i.payload.catalog?.contentKey).map((i) => owners.get(i.parent_id))))].join(" | ") };
  });
  const plans = rows.map((r) => {
    const actions = [], checks = dataChecks(r), used = usage(r);
    if (r.tags.includes("fuente_pendiente")) actions.push("Identificar fuente real; no cambiar official/imported por un libro o custom sin evidencia.");
    if (r.tags.includes("descripcion_pendiente")) actions.push("Cotejar si la fuente tiene reglas descriptivas o solo una fila de tabla; no inventar texto oficial ni descartar el objeto.");
    if (r.tags.includes("revisar_descripcion")) actions.push(jsonText(r) ? "Recuperar la definición incrustada por separado y contrastar la versión adaptada; no aplanar ni reemplazar automáticamente." : "Preparar limpieza de presentación conservando palabras, párrafos y listas; revisar etiquetas malformadas antes de convertir.");
    if (checks.category) actions.push(r.value.category === "tools" ? "Normalizar categoría tools a tool conservando subtipo y competencias." : r.value.category === "mounts-and-vehicles" ? "Incorporar monturas, vehículos y accesorios al vocabulario del editor; conservar sus distinciones." : "Reclasificar munición y proyectiles individualmente; preservar efectos especiales.");
    if (checks.damage) actions.push("Separar daño base y componentes adicionales con tipo, condición y coste; no sumar ambos siempre ni reemplazar la barra por + automáticamente.");
    if (checks.recharge) actions.push("Determinar si es reserva finita, cuentas, deseos o recurso recargable; declarar sin recuperación cuando corresponda. No asignar amanecer por defecto.");
    if (r.tags.includes("revisar_funciones")) actions.push("Leer la capacidad real y distinguir mención de conjuro de lanzamiento concedido; estructurar solo los efectos confirmados.");
    if (byName.get(token(r.name)).length > 1) actions.push(recommendations[token(r.name)] ?? "Resolver versiones homónimas.");
    if (r.tags.includes("version_local")) actions.push("Comparar diferencia de ECE con la base: conservar alias/intención de campaña o corregir el error demostrado.");
    if (/\+[123]$/.test(r.name) && r.value.rarity === "none") actions.push("La rareza está ausente pese al nombre con bonificación: cotejar índice, versión y rareza; no clasificar como mundano.");
    if (r.value.category === "potion" && r.value.rarity === "none") actions.push("La poción carece de rareza declarada: cotejar datos además del texto.");
    return { clave: r.content_key, nombre: r.name, indice: r.payload.index ?? "", categoria: r.value.category, etiquetas: r.tags.join(" | "), prioridad: used.length ? "1: revisar copia usada antes de migrar" : "2: catálogo; resolver identidad antes de limpiar", referencias_confirmadas: used.filter((i) => i.payload.catalog?.contentKey).map((i) => owners.get(i.parent_id)).join(" | "), coincidencias_nombre_no_confirmadas: used.filter((i) => !i.payload.catalog?.contentKey).map((i) => owners.get(i.parent_id)).join(" | "), propuesta: actions.join(" | ") || "Conservar; no se detectó una acción adicional en esta revisión, sin certificar texto o automatización." };
  });
  const links = inventory.map((r) => {
    const key = r.payload.catalog?.contentKey, candidates = key ? (byKey.has(key) ? [byKey.get(key)] : []) : byName.get(token(r.payload.name)) ?? [];
    return { personaje: owners.get(r.parent_id), id: r.entity_id, nombre: r.payload.name, clave: key ?? "", estado: key ? (candidates.length ? "referencia explícita" : "referencia no encontrada") : candidates.length > 1 ? "nombre ambiguo" : candidates.length ? "nombre único candidato" : "sin coincidencia automática", candidatos: candidates.map((c) => c.content_key).join(" | "), propuesta: key ? "Conservar identidad y comparar cambios de la copia antes de aplicar correcciones de catálogo." : candidates.length > 1 ? "Resolver versión antes de vincular; conservar mientras tanto." : candidates.length ? "Cotejar estadísticas y personalizaciones antes de vincular; el nombre solo propone una correspondencia." : "Conservar; investigar alias, paquete del tutorial, traducción o contenido personal. No eliminar por falta de coincidencia." };
  });
  csv("plan-por-entrada.csv", plans); csv("versiones-homonimas.csv", duplicates); csv("copias-personajes.csv", links);
  const summary = {
    mode: "Análisis: no se modificaron catálogos, inventarios, reglas ni código de aplicación.",
    freshness: { catalogHashMatchesLastVerification: true, sharedHashMatchesLastVerification: true, inventoryReadFresh: true },
    spanishEntries: rows.length, inventoryCount: inventory.length, characterCores: owners.size,
    warningGroupsOverlap: true,
    data: { total: rows.filter((r) => r.tags.includes("revisar_datos")).length, categories: count(rows.filter((r) => dataChecks(r).category), (r) => r.value.category), mixedDamage: rows.filter((r) => dataChecks(r).damage).length, missingRecharge: rows.filter((r) => dataChecks(r).recharge).length },
    descriptions: { empty: rows.filter((r) => r.tags.includes("descripcion_pendiente")).length, emptyCategories: count(rows.filter((r) => r.tags.includes("descripcion_pendiente")), (r) => r.value.category), flagged: rows.filter((r) => r.tags.includes("revisar_descripcion")).length, embeddedJson: rows.filter(jsonText).map((r) => r.name), emptyBonusedNames: rows.filter((r) => r.tags.includes("descripcion_pendiente") && /\+[123]$/.test(r.name)).map((r) => r.name), emptyPotions: rows.filter((r) => r.tags.includes("descripcion_pendiente") && r.value.category === "potion").map((r) => r.name) },
    sources: { pending: rows.filter((r) => r.tags.includes("fuente_pendiente")).length, pendingWithLocalSrdIndexCandidate: rows.filter((r) => r.tags.includes("fuente_pendiente") && localSrd.some((s) => s.index === r.payload.index)).length, indexMatchIsNotIdentityCertification: true, spanishImports: rows.filter((r) => r.origin === "imported").map((r) => r.name) },
    repeatedNames: duplicates.length, rowsWithRepeatedNames: [...byName.values()].filter((group) => group.length > 1).reduce((n, group) => n + group.length, 0),
    inventoryLinks: count(links, (r) => r.estado), inventoryWithZeroMaximum: inventory.filter((r) => r.payload.charges?.maximum === 0).map((r) => ({ owner: owners.get(r.parent_id), name: r.payload.name })),
  };
  writeFileSync(`${out}/resumen.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally { await server.close(); }
