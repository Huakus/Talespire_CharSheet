# Migración de equipo de ECE — 18 de octubre de 2026

**Actualización posterior:** la [resolución de las 25 entradas apartadas](EQUIPMENT_OFFICIAL_RESOLUTION_2026-10-18.md) llevó ECE a la revisión 1285: retiró quince entradas, normalizó dos objetos oficiales y añadió seis cinturones concretos. Quedan ocho apartadas y 836 definiciones normalizadas activas. Las cifras de abajo describen el estado previo, revisión 1284.

La migración está aplicada en la base remota de ECE, revisión **1284**, y la aplicación está compilada en `dist-v2`. Primero se actualizaron las posesiones de personajes y comerciantes; después se normalizó el resto del catálogo conservado en español. No hay que ejecutar una migración manual desde el panel del GM.

| Resultado comprobado | Cantidad |
| --- | ---: |
| Personajes que cargan con sus datos reales | 16 |
| Copias de inventario migradas | 241 |
| Copias en stock migradas | 24, de cuatro NPC comerciantes |
| Definiciones del lote prioritario | 166 |
| Definiciones normalizadas activas, incluido el lote prioritario | 828 |
| Entradas conservadas para revisión, fuera de adquisición por jugadores | 25 |
| Registros originales de preparación conservados sin cambios | 853 |
| Copias sin reglas o con revisión de catálogo incorrecta | 0 |
| Copias cuya definición difiere de la publicada | 0 |
| Cambios accidentales de identidad, cantidad, precio, orden, grupo, equipamiento o sintonización | 0 |

La [verificación final de inventarios](equipment-preparation-2026-10-17/FINAL_INVENTORY_VERIFICATION.json) se obtuvo de la base después de publicar. Se actualizaron tanto `catalog.contentKey` como `catalog.revision`: los inventarios ya utilizan los objetos nuevos. Las descripciones personales y los datos completos anteriores permanecen en cada copia, separados de la definición común.

## Funcionamiento disponible

- Las estadísticas revisadas de armas y armaduras alimentan la ficha y las acciones vinculadas. Los requisitos de equipamiento, sintonización, clase y portador se comprueban antes de habilitar poderes.
- Los bonos compatibles se aplican a atributos, CA, salvaciones, pruebas y ataques de conjuro. Los atributos que se fijan a un valor, establecen un mínimo o tienen un límite se representan por separado.
- Los poderes con coste compatible descuentan sus recursos. La interfaz permite registrar gastos variables, consumos de unidades y recuperaciones confirmadas. Las recuperaciones aleatorias solicitan el resultado; no recuperan siempre el máximo ni presuponen que haya ocurrido un amanecer.
- Las unidades con recursos propios no se fusionan en comercio o transferencias. La corrección se aplicó también a la función privada de comercio en la base de datos.
- Los conjuros otorgados por objetos se habilitan por su fuente y requisitos. Lanzarlos registra su gasto y concentración cuando corresponde; no se incorporan como conjuros aprendidos de la clase. Se reconcilian al adquirir, vender y transferir el objeto.
- La Capa con runas aporta un espacio adicional de nivel 1 cuyo gasto y recuperación siguen al conjunto de espacios del portador. Quitársela y volver a equiparla no rellena ese espacio.
- El Anillo de almacenamiento de conjuros guarda entradas y niveles, no cargas. Delerion lo tiene **vacío**, según lo confirmado. Desde su detalle se registra un lanzamiento ya realizado por otro lanzador, con sus valores originales; al usarlo se retira el conjuro almacenado, sin gastar un espacio del portador. El portador mantiene la concentración si corresponde.
- El arco de Arturo referencia **Arco largo feroz**. Hoja Fásica permanece en la variante exclusiva de Stix.
- Las descripciones estructuradas muestran párrafos, listas y tablas; la información original y las descripciones propias siguen accesibles en «Reglas y funcionamiento».

Se corrigieron las cachés de CA que cambiaron por los perfiles revisados: Stix tiene **17** y Delerion **15**. Mercion conserva 20 y Garrick 23: sus fichas antiguas ya declaraban el estilo Defensa, ahora proyectado mientras llevan armadura. Se verificó que los demás campos de estado, incluidos PG, moneda, espacios y condiciones, permanecieran iguales.

## Alcance real de la automatización

**Normalizado no significa certificado como definitivo ni completamente automatizado.** Las reglas que necesitan selección de objetivos, intervención del GM, procedimientos especiales o una fuente que todavía no se pudo verificar permanecen como resolución asistida. El detalle de cada objeto enumera lo que falta automatizar. Un botón de gasto no afirma haber aplicado un efecto al objetivo o al tablero.

Entre esos límites están las condiciones y daños situacionales, varias resistencias y propiedades especiales, transformaciones, invocaciones y otros poderes singulares. El Laúd de Doss conserva su información y requisitos, pero no se presenta como un conjunto completo de lanzamientos con siete contadores independientes: falta cotejar íntegramente su fuente y conectar esa mecánica al inventario activo. La fuente pública consultada confirma beneficios generales de los instrumentos de los bardos, pero no basta para reconstruir todas las particularidades del laúd. No se inventaron reglas para completar esos huecos.

La edición antigua de preparación sigue siendo un archivo de recuperación. Sus indicadores históricos no se reescribieron para hacer pasar los objetos por definitivos. Cerrar la cobertura de cada campo original, acreditar todas las fuentes y completar los adaptadores siguen siendo requisitos para certificar el catálogo y retirar las versiones antiguas.

## Las 25 entradas apartadas de adquisición

Ninguna estaba usada por personajes o comerciantes al aplicar la marca `revision_pendiente`; la transacción comprobó esa condición. Sus payloads permanecieron intactos y el GM conserva acceso.

| Grupo | Entradas | Motivo |
| --- | --- | --- |
| Invulnerabilidad, cinco variantes | Cuero, acolchada, cota de malla, pieles y cuero tachonado | La regla oficial cotejada corresponde a placas. No se convirtieron automáticamente en variantes de campaña. |
| Vulnerabilidad, cinco variantes | Cuero, acolchada, cota de malla, pieles y cuero tachonado | Mismo conflicto de subtipo. |
| Armas con combinación dudosa, cuatro | Alabarda berserker, Espada corta vorpal, Espada corta del filo, Red viciosa | Restricciones de familia, daño cortante/perforante o daño base sin resolver. |
| Fuente o reglas de campaña incompletas, ocho | Cristal Carmsí, Varita de molestar, Núcleo Luciente, Armadura Mortis, Daga que regresa, Varita del fastidio, Túnica del Paso de Invierno, Amuleto del Explorador | No hay una fuente primaria inequívoca o faltan parámetros para ejecutar el poder. Se conservan incluso los nombres originales. |
| Fuente posterior no cotejada íntegramente, dos | Amuleto del devoto +1, Tambor del creador de ritmos +1 | Los artículos oficiales identifican estos objetos de Tasha, pero no proporcionan todas sus reglas. No se certificó una descripción reconstruida parcialmente. |
| Variante no elegida, una | Cinturón de Fuerza de Gigante genérico | Hace falta identificar el tipo de gigante; existen las variantes concretas revisadas. |

No se borraron las versiones inglesas ni los archivos de recuperación: todavía son útiles para cerrar esas verificaciones. El trabajo de normalización se concentró en las opciones en español que se van a usar. El catálogo compartido y las demás campañas conservaron sus checksums; `.localstorage/` no se modificó.

## Fuentes y evidencia

Se cotejaron las ediciones [española](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf) e [inglesa](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) del SRD 5.1, junto con los PDF del Manual del Jugador y Xanathar aportados por el usuario. Se distinguen texto español oficial acreditado, traducción propia revisada y reglas de campaña; el PDF aportado no se acredita automáticamente como una edición oficial española. La [atribución del SRD](SRD_5_1_ATTRIBUTION.md) también se muestra donde corresponde.

Los artículos oficiales de D&D Beyond sobre [objetos para bardos](https://www.dndbeyond.com/posts/1186-bard-201-the-best-magic-items-for-bards) y [objetos para paladines](https://www.dndbeyond.com/posts/1243-paladin-201-the-best-magic-items-for-paladins) ayudan a identificar las fuentes, sin sustituir el texto íntegro de sus reglas. No se usaron comentarios de foros para certificar reglas.

Los cotejos del lote restante están en [equipo básico](equipment-preparation-2026-10-17/remaining-mundane-source-review.json), [texto SRD](equipment-preparation-2026-10-17/remaining-srd-text-reviews.json), [variantes y tablas SRD](equipment-preparation-2026-10-17/srd-variants-source-review.json), [Xanathar](equipment-preparation-2026-10-17/remaining-xanathar-source-review.json) y [últimos paquetes y componentes](equipment-preparation-2026-10-17/final-basics-source-review.json). La reconstrucción de tablas comprueba que se conservan las palabras de las columnas originales, incluidas cabeceras y continuaciones.

Validación realizada:

- TypeScript sin errores.
- Suite v2 completa: **111 archivos y 1.113 pruebas aprobadas**.
- Reconstrucción con datos reales: 16 personajes y 241 objetos válidos; 853 preparaciones sin cambios y cero cachés pendientes de corregir, mediante `node scripts/verify-equipment-release.mjs --require-current`.
- Consulta final de referencias y estado individual: 265 copias correctas.
- Compilación `npm run build:v2 -- --emptyOutDir=false` completada. Se conservaron los bundles anteriores que TaleSpire pueda tener abiertos. La única advertencia de compilación es el tamaño del bundle.

Reabrir el symbiote carga la compilación nueva. La migración remota ya está aplicada; la interacción dentro del cliente TaleSpire no se verificó directamente en esta ejecución.
