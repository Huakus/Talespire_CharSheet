# Entrega 1.0.38 — 2026-10-27

## Editores de contenido GM

Los editores de conjuros, objetos y comerciantes usan secciones compactas, columnas que se adaptan al ancho disponible y una barra de Guardar / Descartar que permanece accesible al desplazarse. Los controles booleanos tienen tamaño de checkbox, sin tomar el ancho de los campos de texto. Los datos opcionales se agrupan en secciones plegables.

| Editor | Organización y campos revisados |
| --- | --- |
| Conjuros | Identidad y edición/año; lanzamiento, componentes y materiales; ataque/salvación, dados, escalado y modificador; descripción y niveles superiores; clases y etiquetas. Se conserva la totalidad de `SpellDefinition`, incluidos valores personalizados existentes. |
| Objetos | Identidad, precio y cantidad inicial; arma o armadura según corresponda; propiedades; uso/cargas; bonificaciones y capacidades; descripción, estado inicial y efecto adicional. Se agregó Fuerza requerida para armaduras. Alternar tipo o cargas conserva los valores escritos. |
| Comerciantes | Identidad, NPC y disponibilidad; comercio; negociación y reputación; acciones sobre inventario; existencias con búsqueda/filtros y etiquetas. CAR y Percepción provienen de la ficha del NPC. |

Al guardar un objeto se conservan su definición avanzada, recursos vinculados, capacidades y bonificaciones. La preparación existente sigue disponible para editar las reglas avanzadas. Editar comerciantes conserva categorías anteriores y el contador de intentos de hurto; filtrar existencias conserva el formulario sin guardar. Los cambios inválidos en fórmulas de conjuro muestran un error legible; un fallo de persistencia conserva el borrador. Se impiden envíos duplicados mientras se guarda. Las etiquetas editables de campaña no permiten cambiar la clasificación de origen del conjuro ni convertirlo en una versión `old`.

## Conjuros de criaturas en combate

- La tarjeta expandida del participante ofrece descripción, tiempo, alcance, duración, componentes, materiales y reglas a niveles superiores.
- Los ataques usan el bono de ataque de conjuro de la criatura; las salvaciones muestran su CD y la característica que debe tirar el objetivo. Los efectos tienen botones de dados, incluyendo curación y escalado admitido por la definición.
- Los conjuros con escalado permiten elegir nivel de lanzamiento. La elección se conserva entre tiradas para cada participante; los rayos de Descarga sobrenatural se resuelven individualmente.
- El editor de criaturas permite configurar característica de conjuración, bono de ataque, CD y nivel del lanzador por separado. Los campos vacíos sólo usan valores explícitos e inequívocos del rasgo de conjuración. No se deduce un nivel de lanzador del VD.
- Los nombres de conjuros del PHB en español e inglés se resuelven automáticamente. Las definiciones de campaña tienen prioridad sobre las incorporadas. Editar un conjuro actualiza el catálogo que usa el combate sin reiniciar.
- Una definición o dato de conjuración faltante aparece señalado. No se generan bonos ni dados inventados. Usos, espacios, objetivos y concentración continúan siendo responsabilidad del GM según la ficha.

La configuración de conjuración se conserva en el payload JSON del monstruo y es opcional para perfiles existentes. No se requieren migraciones de tablas ni modificaciones de datos locales de campaña durante el desarrollo.

## Verificación

- TypeScript sin errores.
- Suite general: 142 archivos aprobados y una expectativa de interfaz anterior corregida; 1306 pruebas aprobadas en esa ejecución. Después de la corrección, las 39 pruebas del área y las 44 pruebas finales de edición, conjuros, combate, payloads y CSS pasaron.
- Build seguro con `npm run build:v2 -- --emptyOutDir=false`, ejecutado por el empaquetador mod.io.
- Pruebas de formularios con DOM, guardado, borradores y estilos calculados con la hoja CSS real; pruebas de resolución, escalado, configuración y serialización de conjuros; tiradas desde el encuentro.
- La revisión mediante captura quedó bloqueada por la herramienta de control de interfaz: no pudo verificar con confianza la URL actual de Chrome en Windows. No se declara validación visual dentro de TaleSpire.
