# Entrega 1.0.42 — 2026-10-31

- Las características y salvaciones de las criaturas aparecen exclusivamente en la parte expandida de la tarjeta del encuentro. Se mantienen sus botones de tirada, modos normal/ventaja/desventaja, colores del texto del modificador y nombre individual del combatiente.
- Criaturas y personajes comparten en el resumen los campos de velocidad, Percepción pasiva, Investigación pasiva y Perspicacia pasiva, con las mismas etiquetas. Los lanzadores muestran también CD de conjuros y bono de ataque de conjuro.
- Los personajes toman las pasivas de la proyección de su hoja. Para criaturas se prioriza un valor explícito de Sentidos; en su ausencia se calcula 10 + bono de habilidad, o 10 + modificador de la característica real si no se indica ese bono. Un dato ausente o contradictorio se representa con «—». No se usa una puntuación de característica ficticia para completar el perfil.
- Las pasivas ya presentes en el resumen no se repiten en los detalles del personaje. Defensas, acciones y controles de iniciativa conservan su ubicación y comportamiento.

Verificación: TypeScript y pruebas de UI de combate, cálculo de pasivas, tiradas expandidas con identidad del combatiente, resumen consistente de lanzadores, perfiles incompletos y estilos existentes. El empaquetador ejecuta el build seguro con `--emptyOutDir=false`.
