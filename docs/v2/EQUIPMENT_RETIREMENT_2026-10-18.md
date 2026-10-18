# Limpieza y funciones de los objetos

Estado verificado de ECE: revisión **1304**. El objetivo funcional completo sigue abierto.

| Ámbito | Resultado |
| --- | --- |
| Catálogo activo de ECE | 828 definiciones españolas; 0 inglesas, 0 preparaciones y 0 nombres duplicados detectados |
| Retiradas de ECE | 834 definiciones redundantes y 853 documentos internos de preparación |
| Fuente compartida | 757 definiciones oficiales españolas; 815 filas antiguas, duplicadas o de campaña retiradas |
| Fichas | 16 personajes y 241 objetos; estados, precios propios, referencias y versiones verificados |
| Comerciantes | 24 copias conservadas; las actualizaciones de texto preservaron precios y reservas |
| Reimportación de GM | Las 1.687 claves retiradas de ECE siguen ausentes al ejecutar el RPC normal y revertir la prueba |

Los originales completos están archivados fuera de las opciones de juego. Las retiradas se ensayaron con rollback y se publicaron con guardas de revisión, igualdad de filas, ausencia de referencias vivas y hashes del resto de la base. Las referencias históricas de original, originals y legacyData no se confunden con referencias de uso.

La normalización compartida cotejó íntegramente sus 1.572 filas antiguas. La fuente común usa las definiciones españolas revisadas y excluye notas personales e históricos de ECE. Sus 757 payloads nuevos se volvieron a consultar y coincidieron con los hashes previstos. **Todas las campañas existentes, sus contenidos, fragmentos y versiones conservaron sus hashes durante esa operación**; solo cambió la fuente compartida. No se modificó .localstorage/.

## Información recuperada

Se completaron textos, tablas y contexto de armas, armaduras, herramientas, instrumentos, focos, símbolos sagrados, sillas, embarcaciones y objetos mágicos. Se cotejaron variantes concretas de piedras Ioun, pociones y armas; los errores de las importaciones se resolvieron a favor de las reglas oficiales según el criterio del GM. La entrada inglesa mal llamada “Deck of Illusions” que describía cartas de trece o veintidós elementos se asignó a Baraja de múltiples cosas; la baraja de ilusiones conserva su identidad separada.

Xanathar conserva la transcripción del documento aportado, identificada como traducción revisada cuando no se acredita su edición editorial. El amuleto y el tambor de Tasha usan traducciones propias revisadas del texto inglés existente, con beneficios corroborados por el artículo oficial; no se atribuye esa traducción a la editorial ni se afirma haber consultado el texto de pago íntegro. El catálogo de objetos no amplía los libros del generador de personajes.

## Funciones y presentación

- Las 37 herramientas tienen prueba desde su tarjeta, con característica elegida por el GM, competencia o pericia real, ventaja/desventaja, efectos de condiciones y Talento Seguro. Poseer una herramienta no concede competencia. Útiles de cocinero y utensilios para comer se distinguen.
- El tambor restaura exactamente un uso de Inspiración de Bardo y consume su uso diario en una única mutación. Comprueba la reserva, la capacidad de actuar y la sintonización; recupera el uso del objeto al amanecer, independientemente del descanso.
- Las embarcaciones conservan reglas completas de corrientes y navegación. El bote tiene el peso de 50 kg del SRD español y las velocidades se muestran en español.
- Las tarjetas muestran una vez sus párrafos, tablas y atribución. Las notas propias y reglas diferentes se preservan. Los comentarios internos de migración se excluyen de la tarjeta y las etiquetas de sintonización se traducen. El filtro Utilizables reconoce las capacidades que sustituyen al botón genérico Usar.

## Validación y pendientes

La suite estable pasó **120 archivos y 1.166 pruebas**, sin fallos. TypeScript y la compilación activa con npm run build:v2 -- --emptyOutDir=false pasaron. Se renderizaron las 828 tarjetas: ninguna falló y no se detectaron las frases inglesas ni comentarios de migración buscados. La revisión visual de los controles abiertos a 540 px no mostró desbordamientos. La inspección usa fichas sintéticas y el renderizador real; no sustituye una sesión interactiva dentro de TaleSpire.

Las 16 fichas cargan y sus proyecciones no necesitan cambios de CA o velocidad guardadas. La espada de Garrick apunta a la definición española conservada y mantiene sus datos propios.

**La limpieza no cierra el objetivo funcional.** El inventario de capacidades todavía contiene **403 efectos sin representar** y 162 capacidades declaradas sin adaptador. Algunos poderes ya actúan a través de campos anteriores; esa duplicidad debe conciliarse y validarse antes de dar una capacidad por terminada. Quedan, entre otros, efectos con objetivos o duración, propiedades condicionadas, el uso gratuito de Canalizar divinidad del amuleto y el Laúd de Doss. No se presentan como automatizados por haber retirado sus versiones antiguas.

Evidencia: [estado de ECE](equipment-retirement-2026-10-18/current-status.json), [normalización compartida](equipment-retirement-2026-10-18/shared/verified.json), [validación](equipment-retirement-2026-10-18/completion-validation.json) y [objetivo pendiente](EQUIPMENT_COMPLETION_GOAL.md).
