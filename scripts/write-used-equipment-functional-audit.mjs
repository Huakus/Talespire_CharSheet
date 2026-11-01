import {readFileSync,writeFileSync} from 'node:fs';
import {notes} from './equipment-functional-review-decisions.mjs';
const base='docs/v2/equipment-functional-audit-2026-11-01';
const evidence=JSON.parse(readFileSync(base+'/runtime-evidence.json','utf8'));
const labels={verified:'Función verificada; marcas obsoletas',table:'Uso físico o narrativo en mesa',partial:'Implementación parcial',missing:'Función pendiente',needsRules:'Reglas o fuentes por completar',incorrect:'Resultado incorrecto'};
const escape=s=>String(s).replaceAll('|','\\|').replace(/\r?\n/g,' ');
const report=`# Auditoría funcional de objetos en uso · 1 de noviembre de 2026

Paso 1 cerrado sobre la revisión **1703 de ECE**: 93 definiciones con marcas pendientes, utilizadas por 133 copias (122 de personajes y 11 de comerciantes). Se incluyeron las fichas guardadas con prefijo «-ELIMINAR-», sin retirarlas por su nombre. El total de la campaña era de 14 fichas, 229 copias en personajes y 24 en comerciantes.

## Resultado

| Clasificación | Definiciones |
| --- | ---: |
${Object.entries(evidence.summary.categories).map(([k,v])=>`| ${labels[k]} | ${v} |`).join('\n')}

Las 39 entradas de uso en mesa no necesitan un poder inventado: cuerdas, mapas, ropa y recuerdos conservan utilidad física o narrativa. Muchas aún necesitan una descripción editorial útil. Las 14 verificadas tampoco certifican el catálogo entero: el contador anterior confundía marcas históricas con falta real de ejecución.

## Cuatro defectos comprobados

1. **Amuleto de la sabiduría**: las dos existencias de comerciantes suman WIS +1 y wisdom +1, y aplican +2. La regla aprobada es exclusivamente +1 a las salvaciones de Sabiduría.
2. **Tomo de entendimiento**: equiparlo aumenta SAB de 10 a 12 antes de leerlo; quitarlo devuelve SAB a 10. Falta la lectura de 48 horas en seis días y el aumento permanente, incluido el máximo.
3. **Botas aladas de Varka**: la copia apunta al catálogo y a la revisión correcta, pero carece de definición mecánica. Su recuperación nativa falla. Debe conservarse su contador actual de cero al reparar el vínculo.
4. **Daga del Umbral, variante de Stix**: la exclusividad está vinculada a la ficha antigua de Stix; la ficha actual no puede usar el salto ni recuperar su recurso. Debe reconciliarse su identidad conservando la exclusividad.

## Descripciones

71 de las 93 definiciones muestran problemas editoriales en tarjetas: 70 filtran instrucciones internas como «Conservar y completar» o «falta estructurar»; el Laúd de Doss muestra además una regla histórica de +2 contradictoria con la decisión actual; Cristal de Reserva conserva «Scorching Ray» en inglés. La revisión editorial anterior no buscaba estas expresiones y no acreditaba ausencia de rastros históricos.

## Verificación

Se renderizaron las 133 tarjetas con el código real de BrowserApp en Happy DOM. La reproducción registró **184 comprobaciones: 178 pasaron y seis fallaron**, concentradas en los cuatro defectos anteriores. Las nueve suites existentes relacionadas pasaron sus **49 pruebas**; sus fixtures no cubrían estos estados reales.

Se verificaron pruebas de herramientas, equipo y sintonización, atributos mínimos y máximos, CA, espacios adicionales, gasto y recuperación, concesión y lanzamiento de conjuros por objetos. Los procedimientos narrativos y las condiciones de escena no se confundieron con bonos de ficha.

El paso 1 no emitió escrituras de datos. La comprobación posterior confirmó la revisión 1703, identidades y versiones sin cambios. Los extractos omiten archivos originales internos y no son copias de recuperación para migraciones. No hubo validación visual dentro de TaleSpire ni una nueva verificación de todas las fuentes oficiales.

## Revisión individual

| Nº | Objeto | Clasificación | Funciona | Pendiente |
| ---: | --- | --- | --- | --- |
${evidence.items.map(i=>{const n=notes[i.n]??[i.works,i.remaining];return `| ${i.n} | ${escape(i.name)} | ${labels[i.category]} | ${escape(n[0])} | ${escape(n[1])} |`;}).join('\n')}

## Continuación autorizada

Corregir primero los cuatro defectos, actualizar las copias sin reiniciar recursos ni identidades, y comprobar su uso. Después completar las mecánicas parciales y pendientes, contrastar las nueve reglas incompletas con las fuentes disponibles y limpiar el contenido de todo el catálogo. El objetivo general permanece abierto: no equivale a cambiar todas las marcas a «implementado».

Evidencia: [reproducción completa](equipment-functional-audit-2026-11-01/runtime-evidence.json), [alcance congelado](equipment-functional-audit-2026-11-01/scope.json), [comprobación posterior](equipment-functional-audit-2026-11-01/post-read-verification.json).
`;
writeFileSync('docs/v2/EQUIPMENT_FUNCTIONAL_AUDIT_2026-11-01.md',report);
console.log('Audit report written: 93 definitions.');
