# Entrega 1.0.39 — 2026-10-27

- La escala rojo/verde corresponde únicamente al texto del modificador de característica o salvación. Se satura en −10/+10 y conserva el color habitual para cero. Fondo, borde, nombre de característica y puntuación no se tiñen. Hay variantes de texto para los temas claro y oscuro.
- El visor de tiendas comparte con el inventario de personajes el renderizado de descripciones, tablas, listas, dados y «Leer más / Leer menos». Cuando existe una definición estructurada vinculada, se muestran sus reglas completas, además de las notas propias sin repetir párrafos equivalentes.
- Las capacidades incluyen sus descripciones complementarias, usos, costes y accesos a tiradas. Se muestran también efectos adicionales y reglas de recuperación. Estas tiradas de consulta no gastan existencias ni recursos; los controles de inventario del comerciante siguen disponibles.
- La expansión de las descripciones sobrevive a búsquedas, filtros y otras actualizaciones. Las tiradas conservan los cambios sin guardar del formulario y respetan el modo de dados de la capacidad.

Verificación: TypeScript, 92 pruebas en 9 archivos de inventario, comercio, edición, encuentro y estilos CSS calculados. Se comprueba que los fondos y bordes permanezcan iguales para todos los modificadores, que los extremos tengan el color de texto esperado y que la descripción expandida no esté recortada. Build y paquete mod.io generados mediante el comando seguro que conserva los archivos bloqueados por TaleSpire.
