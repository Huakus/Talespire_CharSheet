# Avance del objetivo de objetos

El objetivo general sigue abierto. Esta entrega cierra las tablas de curación, añade administración de pociones entre fichas, implementa la recuperación de espacios de la Perla de poder y evita que el generador vuelva a entregar versiones inglesas o sin identidad canónica de los objetos oficiales.

## Pociones de curación

| Objeto | Rareza | Curación |
| --- | --- | --- |
| Poción de curación | Común | 2d4 + 2 |
| Poción de curación mayor | Poco común | 4d4 + 4 |
| Poción de curación superior | Rara | 8d4 + 8 |
| Poción de curación suprema | Muy rara | 10d4 + 20 |

Las cuatro identidades son distintas. Las tres primeras compartían indebidamente la tabla de toda la familia; la suprema ya tenía su propia fila. Se corrigieron el catálogo de ECE, la fuente compartida, las 15 copias afectadas de siete personajes y cinco copias en dos comerciantes. Las cantidades, precios, estados y contadores permanecieron iguales. No se eliminó ninguna de las cuatro variantes. Una protección de renderizado limita también las copias antiguas de otras campañas a la fila correspondiente a su efecto de curación; sus datos no se modificaron.

Beber y curarse o administrar a otro personaje consume una dosis y aplica la curación en una única operación. Se comprueban el resultado posible de los dados, la reserva, la capacidad de actuar y las revisiones de ambas fichas. La curación respeta el máximo de PG, los PG temporales y la Forma Salvaje. A 0 PG reinicia las salvaciones de muerte y retira la inconsciencia; no devuelve la vida a una criatura muerta. Los conflictos de guardado no dejan el gasto separado de la curación.

Las pociones de fuerza de gigante de hielo y de piedra conservan identidades separadas aunque ambas establezcan Fuerza 23; la poción de veneno conserva también su identidad propia. No se fusionaron por coincidencia de una cifra o del aspecto de su líquido.

## Recuperación de espacios

La Perla de poder ahora elige un espacio realmente gastado y descuenta su uso diario junto con la recuperación. Los espacios superiores al nivel 3 se convierten a nivel 3, conforme a la regla de [Basic Rules de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/magic-items#PearlofPower). El espacio convertido se puede lanzar desde Conjuros, permanece con el personaje aunque retire la perla y conserva su reserva de origen hasta el descanso correspondiente. No permite recuperar de nuevo su espacio original mientras ya esté representado por la conversión. La reserva del objeto solo vuelve al amanecer.

La conversión funciona también con Magia de pacto; se conserva al subir de nivel y vuelve a la reserva ordinaria con su descanso. Recuperación arcana y Adivinación experta distinguen los espacios realmente gastados de los originales ya convertidos, e incluyen las reservas de espacios concedidos por objetos. Sus controles usan la misma disponibilidad que la validación de dominio.

Se actualizaron la definición de ECE, sus tres copias y la fuente compartida. Se mantuvieron los estados disponibles o gastados que ya tenían las copias.

## Equipo entregado por el tutorial

La auditoría descubrió que el generador seguía usando plantillas de importación: existían 38 objetos nuevos sin referencia, incluidos un Orbe y una Bolsa de componentes en inglés. Las 237 plantillas oficiales del catálogo de compras ahora incluyen nombres, reglas e identidades españolas del catálogo revisado. Las variantes de Carreta y Carruaje tienen correspondencias explícitas. También se resolvieron nombres abreviados del equipo inicial, munición, ropa, juegos y herramientas.

La creación utiliza la revisión actual del catálogo cargado cuando está disponible. Los nombres personales y las descripciones particulares se conservan; los regalos y apuntes sin correspondencia inequívoca no se convierten en variantes de otro personaje. Las plantillas españolas incluidas permiten crear sin conexión.

Se vincularon 36 copias de tres fichas con 22 definiciones existentes. Dos objetos de Notas de estudio y plegarias, sin descripción, permanecen como pertenencias personales. No se inventó su contenido ni se les atribuyeron propiedades de las notas de Delerion 2 o Delerion 3.

## Verificación y trabajo restante

La revisión 1450 tiene 828 definiciones de ECE y 757 compartidas, todas españolas, y no presenta nombres duplicados en ECE. Las referencias de los 294 objetos de 20 personajes y de las 24 copias de comerciantes son válidas. Cada publicación comparó sus filas originales y protegió el resto de la base con hashes; las modificaciones detectadas durante el trabajo se releyeron antes de confirmar. Los originales completos y las verificaciones están en `equipment-completion-2026-10-19/`.

La suite general pasó 125 archivos y 1.197 pruebas. TypeScript y la compilación con `npm run build:v2 -- --emptyOutDir=false` pasaron. La auditoría renderizó las 828 tarjetas y no encontró las frases inglesas ni comentarios internos de migración buscados. Las pruebas cubren el renderizado de cada variante, las transacciones de curación y recuperación, los conflictos, la recarga y la persistencia granular. Se conserva una vista previa local de los controles nuevos; su revisión visual interactiva en TaleSpire queda pendiente porque no hay navegador controlable disponible en este entorno.

El inventario funcional todavía contiene 402 efectos sin representar y 158 capacidades declaradas sin adaptador. Son indicadores de revisión: algunos ya funcionan mediante otros campos, y otros requieren implementación real. Faltan, entre otros, las Botas aladas con su duración y recarga condicionada, Canalizar divinidad desde el Amuleto del devoto, el Laúd de Doss y propiedades con objetivos o condiciones especiales. El objetivo no se marca como completo por haber limpiado los catálogos. El goal del sistema continúa en estado `usageLimited`; no se creó otro ni se declaró alcanzado.
