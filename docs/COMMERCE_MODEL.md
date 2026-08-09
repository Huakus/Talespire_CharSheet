# Modelo de comerciantes

La interfaz y el código usan estos conceptos canónicos:

- **Comerciante**: configuración de comercio e interacción. Guarda nombre, reputación, comisión, fondos, dificultad y acciones habilitadas.
- **NPC asociado**: monstruo o PNJ que aporta estadísticas e inventario. El editor del monstruo no muestra objetos; el inventario se administra desde el comerciante.
- **Inventario del comerciante**: inventario estructurado del NPC asociado, presentado y editado únicamente dentro del comerciante.
- **Comprar**: el personaje recibe objetos, paga el precio más la comisión y esos fondos pasan al comerciante.
- **Vender**: el comerciante recibe objetos y paga el precio menos la comisión. La operación se bloquea si no tiene fondos.
- **Persuadir**: con éxito reduce la comisión un paso; un fallo no modifica comisión ni reputación.
- **Intimidar**: con éxito reduce la comisión dos pasos. La pérdida de reputación por éxito se configura para cada comerciante; un fallo resta el doble de ese valor.
- **Hurtar**: usa Juego de manos. Valor, peso, reputación, Percepción del NPC y sospecha aumentan su CD.
- **Implantar**: usa Juego de manos y se resuelve por un único objeto y cantidad. Usa la misma dificultad por valor, peso y sospecha que Hurtar. Todo intento de Hurtar o Implantar incrementa la sospecha y suma +2 a la CD de los intentos discretos siguientes de esa interacción.
- **Asaltar**: usa Intimidación basada en Fuerza. Transfiere objetos sin dinero y reduce reputación.
- **Saquear**: transfiere objetos sin dinero cuando el NPC está inconsciente o muerto y la acción está habilitada.

Todos los importes de las operaciones se calculan y persisten en monedas de cobre (PC).

## Cálculo de dificultad

Antes de tirar, la confirmación muestra cada componente, su signo y la CD final. Las acciones de negociación y Asaltar usan:

`CD = 10 - reputación + CAR del NPC + dificultad permanente + dificultad puntual`

Hurtar e Implantar usan Percepción y agregan los factores del objeto:

`CD = 10 - reputación + PER del NPC + dificultad permanente + dificultad puntual + valor + peso/cantidad + sospecha`

La reputación se resta porque la confianza facilita la acción. El valor representa una vigilancia mayor sobre objetos costosos; el peso y la cantidad dificultan ocultar la maniobra; la sospecha suma 2 por cada intento discreto previo. Persuadir usa Persuasión, Intimidar usa Intimidación, Hurtar e Implantar usan Juego de manos y Asaltar usa Intimidación basada en Fuerza. Cualquiera de estas tiradas puede consumir inspiración.

## Registro de cambios

El historial registra el resultado de la tirada y cada modificación persistida: comisión, reputación, sospecha, fondos, cantidades del inventario del comerciante, cantidades del inventario del personaje y monedas. Saquear, Hurtar y Asaltar se registran explícitamente como transferencias sin dinero.
