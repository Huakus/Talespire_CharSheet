# Tutorial de Guerrero · Manual del Jugador 2014

> Estado actual al 14/10/2026: nueve clases con Manual 2014 y Xanathar.
> Se agregó [Explorador](RANGER_BUILDER_IMPLEMENTATION.md), con cinco arquetipos y compañero animal.
> Se agregó [Druida](DRUID_BUILDER_IMPLEMENTATION.md), con cuatro círculos y ocho terrenos de Tierra.
> Se agregó [Bardo](BARD_BUILDER_IMPLEMENTATION.md), con sus cinco colegios.
> Se incorporaron [Pícaro](ROGUE_BUILDER_IMPLEMENTATION.md) y
> [Bárbaro](BARBARIAN_BUILDER_IMPLEMENTATION.md), además de Guerrero, Mago,
> Brujo y [Clérigo](CLERIC_XANATHAR_IMPLEMENTATION.md). Los recuentos y pendientes
> del cuerpo de este documento describen su entrega histórica.

Actualizado el 13 de octubre de 2026.

## Uso y alcance

Abrí **Crear con tutorial** en Administrar personajes y elegí el nivel inicial,
del 1 al 20. El recorrido incluye Identidad, Atributos, Formación, Equipo,
las decisiones de cada nivel intermedio y Revisión. Solo la confirmación final
incorpora el personaje completo a la campaña. Después, **Subir de nivel con
tutorial** reutiliza las mismas elecciones para adquirir un nivel por vez.

El borrador se guarda en el navegador, separado de la campaña. **Guardar y
cerrar** permite retomarlo en el mismo dispositivo; **Descartar** borra el
borrador. Los niveles iniciales y sus elecciones también se conservan al cerrar.

Esta entrega cubre Guerrero de una sola clase y sus tres arquetipos del PHB 2014:
**Campeón, Maestro de batalla y Caballero arcano**. Desde el 14 de octubre también
está implementado [Mago y sus ocho escuelas](WIZARD_BUILDER_IMPLEMENTATION.md).
También está implementado [Brujo, sus tres patrones y sus tres dones](WARLOCK_BUILDER_IMPLEMENTATION.md).
Las otras nueve clases, multiclase, suplementos y reglas de 2024 quedan fuera del recorrido.

## Opciones disponibles

| Área | Cobertura |
| --- | --- |
| Origen | Humano estándar/variante; enano de colinas/montañas; alto elfo, elfo de los bosques y drow; mediano piesligeros/fornido; dracónido; gnomo de los bosques/rocas; semielfo; semiorco; tiefling: 15 opciones. |
| Elecciones raciales | Aumentos variables; habilidades; herramientas enanas; idioma adicional; truco del alto elfo; diez ascendencias dracónicas; dote de humano variante. |
| Atributos | Matriz estándar, compra de hasta 27 puntos, o 4d6 descartando el menor. PG de ascenso por 6 fijo o d10. Si TaleSpire confirma solo el envío de una tirada, se ingresa el resultado de la mesa. |
| Trasfondos | Acólito, Charlatán, Criminal/Espía, Artista/Gladiador, Héroe del pueblo, Artesano/Mercader gremial, Ermitaño, Noble/Caballero, Forastero, Sabio, Marinero/Pirata, Soldado y Huérfano: 13 bases y 5 variantes. |
| Personalización | Dos habilidades de trasfondo, dos herramientas/idiomas en conjunto, nombre y rasgo acordado con el GM. La base determina el equipo. Se resuelven competencias duplicadas antes de continuar. |
| Personalidad | Alineamiento, apariencia/edad, dos rasgos, ideal, vínculo, defecto e historia. Se conservan el alineamiento en identidad y los demás detalles en una nota e historial. Las especialidades narrativas se escriben libremente. |
| Estilos | Los seis estilos de 2014; Campeón elige un segundo distinto en nivel 10. |
| Dotes | Las 42 del PHB, requisitos, aumentos y elecciones internas. Alternativa a ASI en 4/6/8/12/14/16/19; humano variante además en nivel 1. Adepto elemental puede repetirse con tipos distintos. La mesa puede deshabilitar dotes. |
| Equipo | Paquetes de clase y trasfondo con sus alternativas, o 5d4 × 10 po para comprar equipo del catálogo. El oro sustituye equipo y dinero de ambos paquetes. Se valida presupuesto, cantidades, armadura, escudo y manos al equipar. Los regalos sin precio no son compras gratuitas. |
| Maestro de batalla | 16 maniobras PHB, cuotas 3/2/2/2 en 3/7/10/15, sustitución opcional al aprender nuevas; herramienta de artesano en 3. Dados 4/5/6 y d8/d10/d12; demás rasgos por nivel. |
| Caballero arcano | Lista completa de mago del PHB entre niveles de conjuro 0–4: 16 trucos y 116 conjuros. Progresión de espacios y conocidos; plazas libres en 3/8/14/20; sustituciones que conservan la escuela permitida de la plaza original. |
| Magia de origen/dotes | Magia racial, Iniciado en magia, Lanzador ritual y Francotirador mágico. Cada conjuro conserva fuente, atributo y forma de lanzamiento. Los usos innatos tienen sus propios contadores y no consumen espacios. |

Las variantes Noble/Retenedores y otros rasgos personalizados se pueden registrar
editando el rasgo del trasfondo con el acuerdo del GM. El generador no representa
sirvientes, monturas o familiares como fichas nuevas automáticamente.

## Qué se calcula y qué se resuelve al jugar

Se generan atributos, competencias, PG, dados de golpe, inventario, acciones,
rasgos y recursos. Se calculan CA, Arquería, Defensa, Duelo ordinario, Atleta
notable del Campeón, Alerta, Observador, Móvil, Duro, Resiliente, Matón de taberna,
CA de Combatiente con dos armas y Maestro de armadura media en sus condiciones
admitidas. Los aumentos de dotes respetan el máximo 20 sin impedir elegir la dote
por sus otros beneficios. Sigilo considera la armadura actual y su excepción por
dote; la velocidad considera Fuerza mínima de armadura pesada y la excepción enana.

Los lanzamientos distinguen Inteligencia, Sabiduría o Carisma por conjuro, con CD,
ataque, escalado admitido y usos separados. Un Caballero arcano conoce conjuros;
no necesita preparación diaria y su clase no concede lanzamiento ritual ni foco
de mago. Los conjuros SRD conservan nombres y descripciones en inglés.

Críticos, resistencias, ventajas situacionales, maniobras, reacciones, ataques
adicionales, repeticiones de dados, curación condicional y la mayoría de efectos
de dotes se registran como reglas y se resuelven con los controles de partida.
Tirar un dado de superioridad no descuenta su uso: se marca en el rasgo. Los
componentes, manos al lanzar, objetivos y requisitos de activación dependen de la
mesa. Rayos múltiples, daño por objetivo o continuado y efectos complejos se
resuelven siguiendo el texto; una expresión de daño no ejecuta el conjuro entero.

Duelo presupone una mano y un único arma equipada; distingue daño versátil. La
lanza de caballería requiere resolver el bono según la montura. Las acciones de
armas representan el ataque normal, no todos sus modos o el ataque de segunda
arma. Los paquetes de aventurero están agrupados con su contenido descrito.

Los descansos largos recuperan también recursos etiquetados para descanso corto.
El GM decide descanso, PX y nivel inicial; el tutorial no impone umbrales de PX.
Las reglas opcionales, idiomas exóticos, descubrimientos y rasgos narrativos
requieren el acuerdo habitual de la mesa.

## Historial, estado y persistencia

`CharacterV2.builder` conserva el origen y cada nivel adquirido; los campos nuevos
usan valores predeterminados para leer fichas y borradores de la primera entrega.
El historial viaja en `character-core` y en exportaciones y respaldos. No se
requieren tablas, fragmentos SQL ni llamadas nuevas al servidor.

Subir conserva PG actuales/temporales, condiciones, inventario, monedas, usos
gastados y espacios consumidos. Solo se agregan las concesiones del nuevo nivel;
no se entrega de nuevo el equipo inicial. Constitución y Duro ajustan también PG
anteriores. Los IDs estables conservan usos aunque cambie el tamaño de un dado.
Las sustituciones retiran las maniobras o conjuros generados reemplazados.

Cada confirmación es atómica e idempotente, incluida la creación directa en nivel
superior. Las revisiones y sumas de comprobación detectan cambios simultáneos;
la fusión rechaza historiales de progresión competidores. Ante un conflicto, se
conserva el borrador para reabrirlo contra el estado actual de campaña.

Las fichas manuales existentes no se adoptan automáticamente y no tienen subida
guiada. La reespecialización no forma parte del asistente. El diseño general v3
y el control de capacidades entre clientes siguen pendientes: clientes anteriores
que desconocen `builder` pueden perderlo al reescribir el núcleo de una ficha.

## Verificación y referencias

La [auditoría](CHARACTER_BUILDER_RULES_AUDIT.md) enumera hitos, pruebas y límites.
La [atribución de contenido](PHB_2014_CONTENT_NOTICE.md) documenta fuentes SRD,
adaptaciones y licencias; también aparece en Identidad → Fuentes y créditos.

La interfaz se verificó mediante DOM, sin navegador conectado a TaleSpire.
Queda pendiente comprobar su presentación visual dentro de la aplicación.
El desarrollo no modifica campañas remotas ni `.localstorage/`.
