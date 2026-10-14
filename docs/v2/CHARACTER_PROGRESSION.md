# Progresión del personaje

La pestaña **Progresión**, junto a **Rasgos**, permite consultar el recorrido de las nueve clases del tutorial 2014, en modo Juego y Edición. También abre personajes existentes y creados inicialmente a nivel alto. No agrega ni modifica datos de campaña.

Cada nivel es desplegable. El último está abierto inicialmente. Se puede buscar por texto sin distinguir mayúsculas/tildes, abrir/cerrar todos los resultados e ir directamente a un nivel.

## Contenido

- Decisiones de creación: raza, trasfondo, método y valores base de atributos, competencias elegidas, origen, dote y método de equipo. Se muestra el inventario inicial recibido, no el inventario actual.
- Decisiones por nivel: subclase, mejoras/dotes o renuncia, estilos, maniobras/disparos, invocaciones/pacto, pericias, idiomas, instrumentos, tótems independientes, entornos, círculo/terreno y opciones del Explorador, incluido su compañero inicial.
- Magia elegida: trucos, conocidos, incorporaciones al libro, Secretos Mágicos, Arcanos, rituales del Tomo, Maestría y Conjuros Característicos. La preparación que se eligió expresamente en el tutorial se identifica como tal.
- Sustituciones: conjuro, invocación, maniobra o entorno, con valor anterior y nuevo en español.
- Beneficios: PG máximos y aumento total del nivel, dados, competencia, atributos, nuevos espacios, idiomas, herramientas, salvaciones, competencias/pericias, iniciativa y PG máximos del compañero cuando corresponden. Los aumentos de PG incluyen ajustes retroactivos de Constitución y dotes.
- Rasgos nuevos o mejorados: descripción íntegra del motor existente y cambios de usos máximos/recuperación. También se muestran los rasgos retirados por una sustitución.
- Magia incorporada automáticamente: distingue libro, conocidos, trucos, rituales, innatos, conjuros disponibles para preparar y siempre preparados de dominio/terreno. Incorporarse a la lista de preparación no equivale a estar preparado.

## Reconstrucción y límites

`projectCharacterProgression` reconstruye una ficha temporal desde la creación guardada y aplica cada ascenso con los mismos constructores y validadores utilizados por el tutorial. Compara las concesiones de cada nivel con el anterior. No implementa otra tabla de reglas ni escribe al repositorio. Los campos de decisión se presentan mediante `progressionChoices`, con los nombres de los catálogos españoles.

Las copias al libro de Mago incluyen su nivel en el registro existente. Se introducen después de las concesiones de ese nivel, en una sección de aprendizaje fuera del tutorial. Así las elecciones posteriores de preparación, Maestría o Conjuros Característicos pueden depender de ellas sin atribuirlas a un aprendizaje gratuito. La preparación diaria, recursos gastados, cambios de equipo, reemplazos de compañero y demás acciones de juego se consultan en la ficha actual.

La vista usa una caché en memoria que se invalida al cambiar el personaje, historial, copias al libro o datos relevantes de la ficha. Ignora resultados asíncronos obsoletos. Cambiar de pestaña durante la carga no cambia la pestaña activa. La búsqueda y los desplegables tampoco escriben a la campaña.

Si los atributos o PG máximos actuales difieren de la reconstrucción, se avisa y se muestra el recorrido otorgado por el tutorial. Si el nivel actual no coincide, se informa hasta dónde llega el registro. No se inventan decisiones de fichas manuales, niveles futuros, fechas de ascenso ni opciones que no estén guardadas. Un historial inválido produce un mensaje recuperable, sin impedir usar las otras pestañas.

## Verificación

Pruebas de reconstrucción de niveles 1–20 para las nueve clases, conservación íntegra de las fichas, sustituciones, concesiones automáticas, recursos, PG retroactivos y dotes, lista frente a preparación de magia divina, invocaciones/espacios de pacto, copias de Mago usadas en Maestría, creación a nivel alto, elecciones independientes y diferencias manuales.

Las pruebas de interfaz con happy-dom abren la pestaña real en ambos modos; verifican búsqueda, navegación, desplegables, sustituciones, textos personalizados escapados, fichas manuales, invalidación de caché, resultados obsoletos y errores recuperables. Se verifica que la consulta no llama al guardado del repositorio.

En equipos con carga alta, `npm run test:v2 -- --maxWorkers=2` reduce la concurrencia para que las pruebas extensas de combinaciones no agoten sus límites de tiempo. La compilación usa `npm run build:v2 -- --emptyOutDir=false` para conservar archivos que TaleSpire pueda tener abiertos.
