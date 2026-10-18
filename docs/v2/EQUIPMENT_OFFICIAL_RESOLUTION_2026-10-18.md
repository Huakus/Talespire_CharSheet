# Resolución de las 25 entradas apartadas

**Estado posterior:** el GM identificó los dos objetos de campaña, autorizó consolidar las varitas y retirar los otros cuatro. La [resolución final y las nuevas mecánicas](EQUIPMENT_CAMPAIGN_RESOLUTION_2026-10-18.md) llevan ECE a la revisión 1287: ya no quedan entradas de este grupo apartadas. El contenido de abajo documenta la etapa previa, revisión 1285.

Aplicado en ECE el 18 de octubre de 2026: revisión **1284 → 1285**. El usuario indicó retirar las diez variantes de armadura y utilizar versiones oficiales siempre que exista una correspondencia real. Un nombre parecido o un poder parcialmente similar no autoriza sustituir un objeto de campaña por otro con reglas diferentes.

Se retiraron **15 entradas sin uso**, se normalizaron los **dos objetos oficiales de Tasha** y se crearon **seis variantes concretas del cinturón de fuerza de gigante**. Permanecen **ocho entradas apartadas**. El catálogo tiene ahora **836 definiciones normalizadas activas**; esta cifra no certifica texto oficial español ni automatización completa de todos sus poderes.

## Retiradas y versiones oficiales conservadas

La numeración corresponde a la explicación entregada al usuario antes de su decisión.

| Entradas anteriores | Acción aplicada |
| --- | --- |
| 1–5: Invulnerabilidad de cuero, acolchada, cota de malla, pieles y cuero tachonado | Retiradas. Se conserva la versión oficial de placas. |
| 6–10: Vulnerabilidad de cuero, acolchada, cota de malla, pieles y cuero tachonado | Retiradas. Se conserva la versión oficial de placas, con su regla correcta de resistencia y maldición. |
| 11: Alabarda berserker | Retirada la combinación no oficial. Se conservan Hacha berserker de guerra y a dos manos. |
| 12: Espada corta vorpal | Retirada. Se conservan Espada vorpal larga y espadón. |
| 13: Espada corta del filo | Retirada. Se conservan Espada de hoja afilada larga y espadón. |
| 14: Red viciosa | Retirada: no hay un tipo de daño base de la red al que aplicar su texto. No se inventó una red custom ni se sustituyó por otra arma arbitraria. |
| 15: Cinturón de Fuerza de Gigante genérico | Retirado como objeto adquirible y sustituido por seis fichas concretas, sin elegir por el usuario una variante al azar. |
| 16: Amuleto del devoto +1 | Conservado como objeto oficial de Tasha, con sintonización por clérigo o paladín, bonos de conjuros y reserva diaria independiente. |
| 17: Tambor del creador de ritmos +1 | Conservado como objeto oficial de Tasha, con sintonización por bardo y bono aplicado solo a conjuros de bardo, no a cualquier conjuro que use Carisma. |

«Retirada» significa baja lógica mediante `deleted_at`. Los quince payloads originales permanecen íntegros y se verificaron contra la instantánea anterior. Antes de modificar el lote se comprobó, dentro de la transacción bloqueada, que ninguna de las diecisiete entradas antiguas tuviera referencias de personajes o comerciantes. No fue necesario redirigir inventarios en este lote; sus versiones oficiales existentes conservan sus referencias y revisiones.

Las variantes de cinturón son:

| Gigante | Fuerza proporcionada | Rareza |
| --- | ---: | --- |
| Colinas | 21 | Rara |
| Piedra | 23 | Muy rara |
| Escarcha | 23 | Muy rara |
| Fuego | 25 | Muy rara |
| Nubes | 27 | Legendaria |
| Tormentas | 29 | Legendaria |

Exigen llevarse puestas y sintonización. No reducen una Fuerza igual o superior. La tabla y el texto proceden del [SRD 5.1 español](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf), página PDF 243. Se separaron correctamente Fuerza y rareza en cuatro filas que el PDF extrae en un único fragmento, verificando que se conservan todas las palabras. Piedra y escarcha mantienen identidades distintas aunque concedan el mismo valor. No se inventaron precios oficiales ni pesos.

## Limitaciones expresas de los dos objetos de Tasha

Los artículos oficiales de D&D Beyond identifican el [amuleto](https://www.dndbeyond.com/posts/1243-paladin-201-the-best-magic-items-for-paladins) y el [tambor](https://www.dndbeyond.com/posts/1186-bard-201-the-best-magic-items-for-bards), sus requisitos y beneficios generales. Las páginas del libro redirigen a la tienda; **no se obtuvo el texto íntegro del manual ni una traducción oficial española acreditada**.

Su identidad oficial está resuelta. El texto procede de la versión española ya existente, con las restricciones corregidas, y conserva `cotejo_textual_pendiente`; los bloques no se etiquetan como transcripción oficial española. El origen importado completo permanece en `rules.original`. No se amplían las fuentes del generador de personajes.

Los bonos funcionan con sus requisitos. El tambor distingue el origen del conjuro; los accesos por objetos y los conjuros de otras clases no reciben su bono por compartir característica. Las fichas manuales sin origen identificable requieren identificarlo antes de atribuir un conjuro al bardo.

Ambos tienen un uso de la propiedad especial recuperable al amanecer, separado de las reservas de clase. La interfaz registra el gasto y la recuperación del objeto. Elegir y resolver Canalizar divinidad sin gastar su uso normal, o recuperar el uso en la reserva concreta de Inspiración bárdica, siguen siendo pasos asistidos y aparecen como tales. No se afirma que el botón haya restaurado o ejecutado automáticamente un rasgo de clase.

## Las ocho entradas que quedan

No se acreditó una versión oficial con los mismos efectos para estas entradas. Permanecen sin cambios y fuera de adquisición por jugadores.

| Nº anterior | Objeto | Qué falta resolver |
| --- | --- | --- |
| 18 | Cristal Carmsí / Carmesí | Confirmar si es una reliquia narrativa sin poderes usables o definir sus mecánicas. |
| 19 | Varita de molestar | Definir efecto, salvación, alcance, duración, activación y coste; distinguirla de la Varita del fastidio. |
| 20 | Núcleo Luciente | Elegir la versión Adaptada o la externa: recuperación, rareza, herramientas, vinculación y consumo del cristal. |
| 21 | Armadura Mortis | Completar límites del teletransporte, daño adicional, duración después de la muerte y reglas contradictorias para retirarla. |
| 22 | Daga que regresa | Precisar si recuperar y atacar comparten acción adicional, la tirada de ataque, obstáculos y sintonización. |
| 23 | Varita del fastidio | Confirmar su efecto narrativo sin penalizadores y la indestructibilidad; distinguirla de la número 19. |
| 24 | Túnica del Paso de Invierno | Definir disparador de reacción, receptores del daño, superposición de áreas y sintonización. |
| 25 | Amuleto del Explorador | Confirmar el +3 solo a Percepción pasiva y reflejarlo en su descripción. |

## Verificación

Se ejecutó primero la transacción completa con rollback y después se publicó con las mismas guardas. Se verificaron los ocho payloads publicados contra los resultados reales de la base, las quince retiradas con sus payloads intactos y las ocho entradas aún apartadas.

Los checksums de todos los registros fuera del lote, catálogo compartido, inventarios, versiones de personajes, preparaciones y demás campañas permanecieron iguales antes y después. `.localstorage/` no se modificó. TypeScript y la suite v2 completa pasaron: **112 archivos y 1.118 pruebas**. La aplicación se compiló mediante `npm run build:v2 -- --emptyOutDir=false`. La primera ejecución de la suite con concurrencia predeterminada agotó tiempos en seis combinaciones masivas de creación; la repetición con dos workers completó todas las pruebas sin cambiar sus límites ni omitir casos.

Evidencia: [decisiones y variantes](equipment-preparation-2026-10-17/official-resolution-decisions.json), [verificación posterior](equipment-preparation-2026-10-17/official-resolution-verified.json) y [definiciones publicadas](equipment-preparation-2026-10-17/official-resolution-definitions.json).
