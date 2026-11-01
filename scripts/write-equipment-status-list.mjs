import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { groups, notes } from './equipment-functional-review-decisions.mjs';

const root = 'docs/v2/equipment-status-2026-11-01/';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const catalog = Array.from({ length: 9 }, (_, i) => read(root + `catalog-${String(i).padStart(2, '0')}.json`)).flat();
const owners = new Map(read(root + 'owners.json').map(o => [o.id, o.name]));
const usage = read(root + 'usage.json').map(u => ({ ...u, owner: owners.get(u.owner_id) ?? u.owner }));
const audited = read('docs/v2/equipment-functional-audit-2026-11-01/scope.json').items;
const auditByKey = new Map(audited.map((r, i) => [r.key, i + 1]));
const staged = new Map(read('docs/v2/equipment-last-charge-outcomes-2026-11-01/decisions.json').map(r => [r.key, r]));
const categories = {
  'adventuring-gear': 'Equipo de aventuras', weapon: 'Arma', armor: 'Armadura', shield: 'Escudo', tool: 'Herramienta', ammunition: 'Munición',
  potion: 'Poción', scroll: 'Pergamino', wand: 'Varita', staff: 'Bastón', rod: 'Vara', ring: 'Anillo', 'wondrous-item': 'Objeto maravilloso',
  mount: 'Montura', vehicle: 'Vehículo', tack: 'Equipo de montura', other: 'Otro',
};
const labels = {
  partial: 'Pendientes concretos', rules: 'Reglas o datos incompletos', verified: 'Función verificada; cierre por revisar',
  table: 'Uso en mesa revisado', unknown: 'Revisión individual pendiente',
};
const specificNotes = new Map([
  [4, ['Ataque del arma y +7 exclusivamente con 20 natural, sin duplicar el valor fijo en críticos.', null]],
  [9, ['Solo +1 a las salvaciones de Sabiduría; se corrigió la duplicación WIS/wisdom.', null]],
  [12, ['Arco y +7 exclusivamente con 20 natural.', null]],
  [17, ['Vuelo activo, mínimo de un minuto, consumo de tiempo, descenso y recuperación por 12 h sin uso implementados. El contador de Varka se conservó.', null]],
  [18, ['Prueba de Sigilo con ventaja solo al moverse silenciosamente.', null]],
  [23, ['Espacio adicional de nivel 1 con uso y recuperación heredados del recurso de clase.', null]],
  [24, ['Carisma +1 sujeto a los requisitos del objeto.', null]],
  [36, ['Hoja Fásica con 20 natural, críticos de 2014, exclusividad de las dos fichas de Stix y recurso del salto corregidos.', 'Falta conectar destino visible y desocupado, alcance de 15 pies y desplazamiento del salto. La definición tampoco tiene perfil de arma; las copias conservan el suyo, que debe conciliarse.']],
  [37, ['INT mínima 19 al cumplir los requisitos; no reduce una Inteligencia natural superior.', null]],
  [39, ['Arma y +7 exclusivamente con 20 natural.', null]],
  [40, ['Arma, encendido/apagado de la hoja, 2d6 de fuego y dados de crítico conectados; apagar al desequipar.', 'Falta integrar la iluminación y comprobar las condiciones de soltar o envainar en la escena.']],
  [54, ['Laúd identificado como Doss; se retiró del texto activo el antiguo +2 contradictorio.', 'Falta contrastar la regla oficial completa de Doss de 2014 y conectar sus conjuros, usos independientes y restricciones.']],
  [69, ['Prueba de Fuerza o Atletismo con ventaja condicionada a hacer palanca.', null]],
  [80, ['INT +1 y gasto de Marca de la Cercanía con recuperación al amanecer.', 'Faltan iluminación y Percepción condicionada, objetivo/concentración/duración de la marca, umbral de PG y bloqueo de PG temporales, Presencia Persistente y contrapartidas de Susurro.']],
  [86, ['Estudio de 48 h en seis días, SAB +2 y máximo +2 permanentes, consumo de magia y recuperación de un siglo.', null]],
  [91, ['Conjuro concedido desde la varita, gasto de carga, recuperación y d20 de última carga con destrucción en 1.', 'La aplicación de Armadura de mago al objetivo y sus ocho horas continúa asistida.']],
]);
// Only genuinely specific catalog notes are promoted to concrete findings. Generic migration
// placeholders and declarations of “unsupported” are evidence to investigate, not a diagnosis.
const specificPending = [
  /Seleccionar la montura receptora/,
  /Resolver desventaja por proximidad y dos manos/,
  /Desembalar y vincular automáticamente cada componente/,
  /Controlar un único ataque y resolver la liberación/,
  /Seleccionar el objetivo, resolver su salvación de Sabiduría/,
  /Desglosar la bolsa y registrar el consumo y recuperación de proyectiles/,
];
const unique = a => [...new Set(a)];
const entries = catalog.map(row => {
  const n = auditByKey.get(row.key), caps = row.capabilities, effects = caps.flatMap(c => c.effects);
  const unmodeled = effects.filter(e => e.kind === 'unmodeled').length;
  const unsupported = caps.filter(c => c.execution.mode === 'unsupported').length;
  const uses = usage.filter(u => u.key === row.key);
  let status = 'unknown', observed = [], pending = [], unknown = true;
  let reviewedFunction = false;
  if (n) {
    const evidence = specificNotes.get(n) ?? notes[n];
    if (evidence) {
      observed.push(evidence[0]);
      if (specificNotes.has(n)) {
        reviewedFunction = true;
        if (evidence[1]) { status = 'partial'; pending.push(evidence[1]); unknown = false; }
        else status = 'verified';
      } else if (groups.needsRules.includes(n)) { status = 'rules'; pending.push(evidence[1]); unknown = false; }
      else if (groups.missing.includes(n) || groups.partial.includes(n)) { status = 'partial'; pending.push(evidence[1]); unknown = false; }
      else if (groups.verified.includes(n)) { status = 'verified'; reviewedFunction = true; }
      else if (groups.table.includes(n)) {
        status = 'table';
        // These two findings describe missing content/workflows, rather than a normal GM ruling.
        if ([34, 55].includes(n)) { pending.push(evidence[1]); status = 'partial'; unknown = false; }
      }
    } else if (groups.table.includes(n)) {
      status = 'table'; observed.push('Uso físico o narrativo revisado; no necesita inventar un bono de ficha.');
    }
  }
  const kinds = new Set(effects.map(e => e.kind));
  if (kinds.has('tool-check') && !pending.length) {
    status = 'verified'; reviewedFunction = true;
    observed = ['Prueba nativa de herramienta con característica elegida, competencia/pericia y Talento Seguro cuando corresponde.'];
  }
  if (kinds.has('study')) {
    status = 'verified'; reviewedFunction = true;
    observed = ['Estudio de 48 h en seis días, beneficio permanente de atributo y máximo, consumo de magia y recuperación de un siglo. Constitución también actualiza los PG y cuenta al subir de nivel.'];
  }
  if (kinds.has('channel-divinity-use')) {
    status = 'verified'; reviewedFunction = true;
    observed = ['Uso adicional de Canalizar Divinidad de clérigo o paladín, junto con el poder elegido, sin gastar el uso normal de clase; recuperación al amanecer.'];
  }
  if (caps.some(c => c.id === 'vicious-natural-20') && !unmodeled && !unsupported) {
    status = 'verified'; reviewedFunction = true; observed = ['Arma y +7 exclusivamente con 20 natural, sin duplicar ese valor fijo en críticos.'];
  }
  if (/^Poción de curación(?: mayor| superior| suprema)?$/.test(row.name)) {
    status = 'verified'; reviewedFunction = true;
    observed = ['Tabla exclusiva de su variante; beber o administrar consume una unidad y aplica su curación en una operación. Receptor a 0 PG recupera consciencia y reinicia salvaciones de muerte.'];
  }
  if (row.name === 'Perla de poder') {
    status = 'verified'; reviewedFunction = true;
    observed = ['Selección de espacio gastado, recuperación a nivel 3 de espacios de nivel 4 o superior y uso del objeto contabilizado por separado hasta el amanecer.'];
  }
  if (caps.some(c => c.execution.handler === 'equipment-spell-storage')) {
    status = 'verified'; reviewedFunction = true;
    observed = ['Almacenar y lanzar conjuros con capacidad de cinco niveles, estadísticas del lanzador original, requisitos de equipo/sintonización y liberación de capacidad al usarlos. El anillo de Delerion se configuró vacío según la indicación del GM.'];
  }
  if (caps.some(c => c.id === 'flaming-toggle' && c.execution.handler === 'equipment-flame-toggle')) {
    status = 'partial'; unknown = false;
    observed = ['Arma, encendido/apagado de la hoja, 2d6 de fuego y dados de crítico conectados; apagar al desequipar.'];
    pending.push('Falta integrar la iluminación y comprobar las condiciones de soltar o envainar en la escena.');
  }
  if (row.name === 'Cristal Carmesí') {
    status = 'table'; observed = ['Reliquia de campaña revisada como contenido narrativo; el texto no define una activación, coste o bono que deba inventarse.'];
  }
  if (row.name === 'Núcleo Luciente Adaptado') {
    status = 'partial'; unknown = false;
    observed = ['Configuración CD 12, resonancias, gasto, duración por tiempo de juego, desgaste, inestabilidad, reparación y recarga condicionada; resistencia al frío con daño tipificado.'];
    pending.push('La clasificación automática de Investigación aeloriana y salvaciones por clima extremo no está conectada. La respuesta de mecanismos del escenario la decide el GM.');
  }
  for (const c of caps) for (const text of c.execution.pendingAutomation ?? []) {
    if (specificPending.some(re => re.test(text))) { pending.push(text); if (status !== 'rules') status = 'partial'; }
  }
  if (['armor', 'shield'].includes(row.category) && !row.armor) {
    pending.push('La definición carece de perfil de armadura/escudo. Falta seleccionar o confirmar la base y completar su CA, Destreza, requisitos y propiedades; no corresponde asignar una base por el nombre.');
    status = 'rules';
  }
  if (row.category === 'weapon' && !row.weapon) {
    pending.push('No hay perfil de arma en la definición. Falta revisar si corresponde elegir un arma base, corregir la clasificación o completar daño, alcance y bonos; aún no sé cuáles son los valores correctos.');
    if (status !== 'rules') status = 'partial';
    unknown = true;
  }
  if (!row.requirements || row.requirements.attunement === null) {
    pending.push('La definición no determina si requiere sintonización; aún no lo sé.'); status = 'rules'; unknown = true;
  }
  if (!row.description_status.blocks || row.description_status.nameOnly) {
    pending.push('Falta una descripción útil: el registro no tiene bloques o solo repite el nombre.');
    if (status !== 'rules') status = 'partial';
  }
  if (row.description_status.unreviewed) {
    pending.push('Existe texto todavía sin revisar contra una fuente; aún no sé qué correcciones exige.'); unknown = true;
    if (status === 'verified' || status === 'table') status = 'partial';
  }
  for (const r of row.resources ?? []) if (r.recovery.kind === 'unknown' || r.maximum === null) {
    pending.push(`Recurso «${r.name}»: ${r.maximum === null ? 'capacidad sin determinar' : ''}${r.maximum === null && r.recovery.kind === 'unknown' ? ' y ' : ''}${r.recovery.kind === 'unknown' ? 'recuperación sin determinar' : ''}. Aún no sé su configuración correcta.`);
    status = 'rules'; unknown = true;
  }
  const lastCharge = kinds.has('last-charge-destruction');
  if (lastCharge) {
    observed.push('Última carga: comprobación d20 pendiente, destrucción con 1, retirada del ejemplar y de sus conjuros; recarga bloqueada hasta resolver.');
    if (n !== 91 && !pending.length) { status = 'partial'; pending.push('La consecuencia de última carga está implementada. Aún no sé qué otras correcciones necesita el conjunto de sus poderes; falta revisar el objeto completo.'); unknown = true; }
  }
  const preparation = staged.get(row.key);
  if (preparation) {
    const detail = preparation.outcome === 'destroy' ? 'Destrucción al gastar la última carga, sin d20.'
      : preparation.outcome === 'nonmagical' ? 'Conservar el anillo como objeto sin magia al gastar su última carga.'
      : preparation.outcome === 'keep' ? 'Con un 20, recuperar 1d12+1 cargas; un 1 no destruye este bastón.'
      : /Sonrisas|Ceños Fruncidos/.test(row.name) ? 'Con un 1, transformar en la otra varita, manteniendo la copia y cero cargas.'
      : row.name === 'Bastón de poder' ? 'Con un 1, conservar solo el arma +2; con un 20, recuperar 1d8+2 cargas.'
      : 'Con un 1, transformar en bastón corriente sin magia ni cargas.';
    pending.push(`${detail} El desarrollo está en preparación, con pruebas pendientes de corregir, y todavía no está publicado; no se cuenta como resuelto.`);
    if (status !== 'rules') status = 'partial';
  }
  if (!observed.length) {
    if (row.weapon) observed.push('Hay un perfil de arma configurado; no equivale a una validación individual.');
    if (row.armor) observed.push('Hay un perfil de armadura/escudo configurado; no equivale a una validación individual.');
    if (!observed.length && !caps.length) observed.push('Registro físico/descriptivo presente; sin revisión funcional individual documentada.');
    if (!observed.length) observed.push(`Hay ${caps.length} capacidad(es) declarada(s); su presencia no demuestra ejecución completa.`);
  }
  if (status === 'unknown') {
    pending.push('Aún no sé qué le falta exactamente; requiere revisar su descripción y sus reglas y probarlo individualmente.');
    if (unmodeled || unsupported) pending.push(`El catálogo conserva ${unmodeled} efecto(s) sin representar y ${unsupported} capacidad(es) declarada(s) sin adaptador; estas marcas requieren comprobación y no prueban por sí solas que todo falle.`);
  } else if (unknown && !pending.some(t => /aún no/i.test(t))) {
    pending.push(status === 'verified' ? 'No detecté un defecto en la función comprobada. Aún no sé si faltan detalles fuera de ese alcance; falta el cierre integral del objeto.' : 'Aún no sé si faltan otros detalles; queda revisar el contenido y el funcionamiento integral.');
  }
  return { key: row.key, name: row.name, category: categories[row.category] ?? 'Sin clasificar', status, statusLabel: labels[status],
    observed: unique(observed), pending: unique(pending), unknown, reviewedFunction,
    unmodeled, unsupported, uses, used: uses.length > 0, publishedRevision: row.revision,
    scope: 'Catálogo ECE', developmentPending: Boolean(preparation),
  };
});
for (const use of usage.filter(u => !u.key)) entries.push({
  key: `personal:${use.owner_id}:${use.item_id}`, name: use.item_name, category: 'Objeto personal', status: 'unknown', statusLabel: labels.unknown,
  observed: ['Objeto conservado en el inventario, sin enlace a una definición del catálogo.'],
  pending: ['Aún no sé si requiere alguna mecánica o corrección descriptiva; falta revisar su contenido. No se enlaza por similitud de nombre.'],
  unknown: true, reviewedFunction: false, unmodeled: 0, unsupported: 0, uses: [use], used: true, publishedRevision: null,
  scope: 'Fuera de catálogo', developmentPending: false,
});
entries.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || a.key.localeCompare(b.key));
entries.forEach((e, i) => e.number = i + 1);
assert.equal(catalog.length, 828); assert.equal(new Set(catalog.map(r => r.key)).size, 828);
assert.equal(entries.length, 829); assert.equal(entries.reduce((n, e) => n + e.uses.length, 0), 253);
assert.ok(entries.every(e => e.observed.length && e.pending.length && (!e.unknown || e.pending.some(p => /aún no/i.test(p)))));
const summary = { date: '2026-11-01', campaignRevision: 1748, catalog: 828, sharedIncluded: 757, personalOutsideCatalog: 1, entries: entries.length,
  characterCopies: usage.filter(u => u.kind === 'character').length, merchantCopies: usage.filter(u => u.kind === 'merchant').length,
  usedDefinitions: entries.filter(e => e.used && e.scope === 'Catálogo ECE').length,
  statuses: Object.fromEntries(Object.keys(labels).map(k => [k, entries.filter(e => e.status === k).length])),
  unknownScope: entries.filter(e => e.unknown).length, developmentNotPublished: entries.filter(e => e.developmentPending).length,
  rawUnmodeled: entries.reduce((n, e) => n + e.unmodeled, 0), rawUnsupported: entries.reduce((n, e) => n + e.unsupported, 0),
  catalogReadOnly: true,
};
const ownerText = e => unique(e.uses.map(u => `${u.kind === 'character' ? 'Personaje' : 'Comerciante'}: ${u.owner}`)).join('; ') || 'Sin copias registradas';
const md = value => String(value).replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
const title = 'Estado individual de todos los objetos · ECE · 1 de noviembre de 2026';
const intro = `Fotografía del catálogo publicado en la revisión **1748**. Incluye **828 definiciones** (las **757 compartidas** ya están incluidas), más **un objeto personal fuera de catálogo**: **829 entradas**. Se consultaron **229 copias de personajes** y **24 de comerciantes**, correspondientes a **157 definiciones** del catálogo y ese objeto personal. Se incluyen las fichas antiguas mientras sus inventarios sigan guardados.\n\n**No es una certificación de que todo esté terminado.** «Función verificada» se limita a las operaciones indicadas; «uso en mesa» no supone que un objeto necesite inventar poderes. Cuando todavía no conozco el pendiente, aparece expresamente **«aún no lo sé»**. Las marcas técnicas de falta de adaptador no se convierten automáticamente en un diagnóstico: algunas pueden ser obsoletas. Los once desarrollos de última carga que siguen en preparación no se contabilizan como publicados.\n\nEsta lista no modifica el catálogo, los inventarios ni los comerciantes. La validación visual dentro de TaleSpire y el cierre integral siguen pendientes.\n`;
const counts = `| Estado | Entradas |\n| --- | ---: |\n${Object.entries(labels).map(([k, label]) => `| ${label} | ${summary.statuses[k]} |`).join('\n')}\n`;
const body = `| Nº | Objeto | Categoría | Estado | Implementación observada o verificada | Qué falta / qué aún no sé | Dónde se usa |\n| ---: | --- | --- | --- | --- | --- | --- |\n` + entries.map(e => `| ${e.number} | ${md(e.name)} | ${e.category} | ${e.statusLabel} | ${md(e.observed.join(' '))} | ${md(e.pending.join(' '))} | ${md(ownerText(e))} |`).join('\n');
writeFileSync('docs/v2/ESTADO_TODOS_LOS_ITEMS_2026-11-01.md', `# ${title}\n\n${intro}\n${counts}\n## Lista completa\n\n${body}\n\nEvidencia de lectura: [catálogo y usos](equipment-status-2026-11-01/). Los identificadores y detalles se conservan en [la lista estructurada](equipment-status-2026-11-01/items.json).\n`);
writeFileSync(root + 'items.json', JSON.stringify({ summary, entries }, null, 2));
writeFileSync(root + 'summary.json', JSON.stringify(summary, null, 2));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const list = items => `<ul>${items.map(t => `<li>${escape(t)}</li>`).join('')}</ul>`;
const rowsHtml = entries.map(e => `<tr data-status="${e.status}" data-used="${e.used}" data-unknown="${e.unknown}" data-search="${escape([e.name, e.category, e.statusLabel, ...e.pending, ownerText(e)].join(' '))}"><td>${e.number}</td><td><strong>${escape(e.name)}</strong><small>${escape(e.category)} · ${e.scope}</small><details><summary>Identificador y alcance</summary><code>${escape(e.key)}</code><p>Revisión publicada: ${e.publishedRevision ?? 'Sin catálogo'}. ${e.unmodeled} efecto(s) sin representar; ${e.unsupported} capacidad(es) declarada(s) sin adaptador.</p></details></td><td><span class="state ${e.status}">${e.statusLabel}</span></td><td>${list(e.observed)}</td><td>${list(e.pending)}</td><td>${escape(ownerText(e))}</td></tr>`).join('\n');
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#f5f6f8;color:#18212b;font:15px/1.5 system-ui,sans-serif}main{max-width:1900px;margin:auto;padding:24px}h1{font-size:26px}header p{max-width:1100px}.counts{display:flex;gap:12px;flex-wrap:wrap}.count{padding:12px 16px;border:1px solid #ccd3dc;border-radius:8px;background:white}.count b{display:block;font-size:25px}.filters{position:sticky;top:0;z-index:2;display:flex;gap:12px;align-items:end;flex-wrap:wrap;background:#f5f6f8;padding:15px 0;border-bottom:1px solid #ccd3dc}label{display:grid;gap:4px}input,select{padding:9px;border:1px solid #758193;border-radius:5px;font:inherit}input[type=search]{width:min(340px,75vw)}.check{display:flex;gap:6px;align-items:center;padding:9px 0}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:white;font-size:14px}th,td{padding:12px;border:1px solid #d8dde5;text-align:left;vertical-align:top}th{background:#e7ecf3}td:nth-child(2){min-width:210px}td:nth-child(4),td:nth-child(5){min-width:260px}small{display:block;color:#495668;margin-top:4px}ul{padding-left:18px;margin:0}li+li{margin-top:7px}.state{display:block;border-radius:5px;padding:6px 9px;background:#edf0f5}.partial{background:#fff0c2}.rules{background:#ffe2de}.verified{background:#def0e2}.table{background:#e0edf9}.unknown{background:#ece8f5}details{font-size:12px;margin-top:8px}summary{cursor:pointer;color:#304a72}code{overflow-wrap:anywhere}tr[hidden]{display:none}a{color:#174f94}@media print{.filters{position:static}.counts{break-inside:avoid}th,td{font-size:10px;padding:6px}main{padding:0}details{display:none}.table-wrap{overflow:visible}}@page{size:landscape;margin:10mm}</style>
<main><header><h1>${title}</h1><p>Catálogo publicado: revisión <strong>1748</strong>. Los 757 objetos compartidos ya están incluidos entre los 828 de ECE. Se añade el único objeto personal sin catálogo. Consulta de solo lectura.</p><p><strong>«Función verificada» no significa objeto íntegramente terminado.</strong> Se informa el alcance comprobado y se dice «aún no lo sé» donde todavía falta diagnóstico. Los desarrollos en preparación no cuentan como publicados. La revisión visual dentro de TaleSpire sigue pendiente.</p><div class="counts"><div class="count"><b>829</b>Entradas</div><div class="count"><b>${summary.statuses.partial}</b>Pendientes concretos</div><div class="count"><b>${summary.statuses.rules}</b>Reglas o datos incompletos</div><div class="count"><b>${summary.statuses.unknown}</b>Sin revisión individual</div><div class="count"><b>253</b>Copias en fichas y comerciantes</div></div><p><a href="ESTADO_TODOS_LOS_ITEMS_2026-11-01.md">Abrir lista en Markdown</a></p></header>
<form class="filters" onsubmit="return false"><label>Buscar por objeto, pendiente o propietario<input type="search" id="search" placeholder="Ej.: poción, Stix, iluminación"></label><label>Estado<select id="status"><option value="">Todos los estados</option>${Object.entries(labels).map(([k, v]) => `<option value="${k}">${v} (${summary.statuses[k]})</option>`).join('')}</select></label><label class="check"><input type="checkbox" id="used">Solo en personajes o comerciantes</label><label class="check"><input type="checkbox" id="unknown">Incluye algo que aún no sé</label><output id="result" aria-live="polite">829 de 829 entradas</output></form>
<div class="table-wrap"><table><thead><tr><th>Nº</th><th>Objeto</th><th>Estado</th><th>Implementación observada o verificada</th><th>Qué falta / qué aún no sé</th><th>Dónde se usa</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><p id="empty" hidden>No hay objetos que coincidan con los filtros.</p></main>
<script>const normalize=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('es');const rows=[...document.querySelectorAll('tbody tr')],search=document.querySelector('#search'),status=document.querySelector('#status'),used=document.querySelector('#used'),unknown=document.querySelector('#unknown');rows.forEach(r=>r.searchText=normalize(r.dataset.search));function filter(){const query=normalize(search.value).trim(),terms=query.split(/\\s+/).filter(Boolean);let count=0;for(const r of rows){const match=(!status.value||r.dataset.status===status.value)&&(!used.checked||r.dataset.used==='true')&&(!unknown.checked||r.dataset.unknown==='true')&&terms.every(term=>r.searchText.includes(term));r.hidden=!match;if(match)count++;}document.querySelector('#result').textContent=count+' de '+rows.length+' entradas';document.querySelector('#empty').hidden=count!==0;}[search,status,used,unknown].forEach(e=>e.addEventListener('input',filter));</script></html>`;
writeFileSync('docs/v2/ESTADO_TODOS_LOS_ITEMS_2026-11-01.html', html);
console.log(JSON.stringify(summary, null, 2));
