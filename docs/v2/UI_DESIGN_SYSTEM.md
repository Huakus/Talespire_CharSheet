# Sistema de diseño de la UI

## Decisión

La UI del Symbiote se mantiene en TypeScript y HTML nativo. No se incorpora un
framework de componentes. La reutilización se construye con tokens CSS,
renderizadores puros y contratos de estado accesibles.

La migración es incremental: las pantallas existentes siguen funcionando
mientras los controles compartidos reemplazan implementaciones locales.

## Capas de color

1. **Tema neutral:** lienzo, superficies, bordes y texto para modo oscuro o
   claro. Estos colores no dependen completamente del acento para preservar la
   legibilidad.
2. **Acento:** parte de un único color elegido. Hover, active, superficie,
   borde, foco, color secundario y texto sobre el acento se calculan desde esa
   entrada.
3. **Semántica:** success, warning, danger e info conservan significado propio.
   Monedas, tipos de daño y categorías de inventario son colores de dominio y
   tampoco se reemplazan por el acento.

La hoja del jugador toma el acento del personaje y la UI GM toma el acento GM.
Ambas usan `--ui-accent` y el mismo motor. `--character-color` se conserva como
alias temporal durante la migración.

## Tokens

Los tokens viven en `src/ui/design-system/tokens.css`:

- `--ui-bg-*`, `--ui-border-*` y `--ui-text-*`: tema neutral;
- `--ui-accent-*` y `--ui-on-accent`: familia calculada del acento;
- `--ui-success`, `--ui-warning`, `--ui-danger`, `--ui-info`: semántica;
- `--ui-space-*`, `--ui-radius-*`, `--ui-control-*`: geometría y densidad.

No se deben agregar colores hexadecimales a componentes o pantallas. Un color
nuevo debe convertirse primero en un token con responsabilidad definida.

## Primitivas iniciales

`src/ui/design-system/primitives.ts` contiene representaciones compartidas de:

- botones primary, secondary, ghost y danger;
- campos de texto, número y búsqueda;
- selectores segmentados;
- controles de cantidad;
- medidores;
- badges.

Las primitivas controlan markup, clases, accesibilidad y estados visuales. La
lógica de dominio permanece en la pantalla consumidora. Por ejemplo, el
control de cantidad aplica `min`, `max` y `disabled`, pero el carrito decide
cuáles son esos valores.

## Contrato de estado

- `disabled`: la acción no puede ejecutarse.
- `aria-pressed`: toggle o segmento seleccionado.
- `aria-current`: destino activo de navegación.
- `data-state`: estado semántico que no tiene equivalente nativo.
- `aria-invalid` y `aria-describedby`: errores de campos.
- `:focus-visible`: foco de teclado obligatorio y visible.

El color nunca es la única forma de comunicar un estado.

## Jerarquía de acciones

- Una acción primary por panel o diálogo.
- Secondary para acciones alternativas.
- Ghost para baja prominencia o barras densas.
- Danger sólo para operaciones destructivas.
- Los botones de icono requieren nombre accesible y tooltip.

## UI Lab

Ejecutar `npm run dev:ui` para abrir `ui-lab.html`. El laboratorio permite
probar temas, acentos, estados de controles, contraste y textos extensos sin
depender de datos de campaña ni modificar `.localstorage/`.

## Orden de migración

1. Comerciante e inventario como piloto compartido.
2. Botones, campos y selectores del jugador y GM.
3. Diálogos, mensajes y estados vacíos.
4. Medidores y controles de recursos.
5. Tarjetas y filas de catálogo.
6. Eliminación de CSS legado sin consumidores.

## Definición de terminado

Una primitiva o pantalla migrada debe cubrir modo oscuro/claro, todos sus
estados, navegación por teclado, contraste de texto, contenido largo y viewport
estrecho. Cada nueva primitiva lleva pruebas de su contrato HTML; el motor de
tema lleva pruebas automáticas de contraste.
